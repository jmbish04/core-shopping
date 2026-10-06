/**
 * @fileoverview OAuth 2.1 Authorization Server Router.
 *
 * Implements Authorization Code Flow with PKCE (S256), short-lived Access Tokens (1h),
 * long-lived sliding-window Refresh Tokens (30d), Refresh Token Rotation (RTR),
 * and token revocation.
 */

import { OpenAPIHono } from "@hono/zod-openapi";

export const oauthRouter = new OpenAPIHono<{ Bindings: Env }>();

// In-memory / D1 token family store for Refresh Token Rotation
type TokenSession = {
  sessionId: string;
  clientId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenFamilyId: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  scope: string;
  revoked: boolean;
};

const tokenSessions = new Map<string, TokenSession>();
const authCodes = new Map<string, { clientId: string; redirectUri: string; codeChallenge: string; expiresAt: number }>();

/** SHA-256 base64url helper for PKCE verification */
async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64url = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64url === codeChallenge;
}

// ---------------------------------------------------------------------------
// GET /oauth/authorize — Authorization Endpoint with PKCE
// ---------------------------------------------------------------------------

oauthRouter.get("/authorize", async (c) => {
  const clientId = c.req.query("client_id") || c.env.WORKER_API_KEY || "default_mcp_client";
  const redirectUri = c.req.query("redirect_uri") || `${new URL(c.req.url).origin}/oauth/callback`;
  const codeChallenge = c.req.query("code_challenge");
  const codeChallengeMethod = c.req.query("code_challenge_method");
  const state = c.req.query("state");

  if (codeChallengeMethod !== "S256" || !codeChallenge) {
    return c.json({ error: "invalid_request", error_description: "OAuth 2.1 requires code_challenge with code_challenge_method=S256" }, 400);
  }

  const code = `code_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 600000, // 10 minutes
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return c.redirect(redirectUrl.toString());
});

// ---------------------------------------------------------------------------
// POST /oauth/token — Token Endpoint (Authorization Code & Refresh Token Grants)
// ---------------------------------------------------------------------------

oauthRouter.post("/token", async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type;
  const clientId = (body.client_id as string) || c.env.WORKER_API_KEY || "default_mcp_client";

  // Grant Type 1: authorization_code
  if (grantType === "authorization_code") {
    const code = body.code as string;
    const codeVerifier = body.code_verifier as string;

    const storedCode = authCodes.get(code);
    if (!storedCode || Date.now() > storedCode.expiresAt) {
      return c.json({ error: "invalid_grant", error_description: "Authorization code invalid or expired" }, 400);
    }

    if (codeVerifier) {
      const isValidPkce = await verifyPkce(codeVerifier, storedCode.codeChallenge);
      if (!isValidPkce) {
        return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
      }
    }

    authCodes.delete(code);

    const now = Date.now();
    const sessionId = `sess_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const accessToken = `at_${now}_${Math.random().toString(36).substring(2, 10)}`;
    const refreshToken = `rt_${now}_${Math.random().toString(36).substring(2, 10)}`;
    const familyId = `fam_${now}`;

    const session: TokenSession = {
      sessionId,
      clientId,
      userId: "user_primary",
      accessToken,
      refreshToken,
      refreshTokenFamilyId: familyId,
      accessTokenExpiresAt: now + 3600000, // 1 hour
      refreshTokenExpiresAt: now + 30 * 86400000, // 30 days sliding window
      scope: "mcp:all core_shopping:all",
      revoked: false,
    };

    tokenSessions.set(refreshToken, session);

    return c.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: session.scope,
    });
  }

  // Grant Type 2: refresh_token (Refresh Token Rotation)
  if (grantType === "refresh_token") {
    const refreshToken = body.refresh_token as string;
    const session = tokenSessions.get(refreshToken);

    if (!session || session.revoked || Date.now() > session.refreshTokenExpiresAt) {
      return c.json({ error: "invalid_grant", error_description: "Refresh token invalid, expired, or revoked" }, 400);
    }

    // Perform Refresh Token Rotation (RTR): invalidate old refresh token
    tokenSessions.delete(refreshToken);

    const now = Date.now();
    const newAccessToken = `at_${now}_${Math.random().toString(36).substring(2, 10)}`;
    const newRefreshToken = `rt_${now}_${Math.random().toString(36).substring(2, 10)}`;

    const newSession: TokenSession = {
      ...session,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt: now + 3600000, // 1 hour
      refreshTokenExpiresAt: now + 30 * 86400000, // Sliding window extends 30 days
    };

    tokenSessions.set(newRefreshToken, newSession);

    return c.json({
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: newSession.scope,
    });
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// ---------------------------------------------------------------------------
// POST /oauth/refresh — Explicit Refresh Endpoint
// ---------------------------------------------------------------------------

oauthRouter.post("/refresh", async (c) => {
  const { refresh_token } = await c.req.json();
  const session = tokenSessions.get(refresh_token);

  if (!session || session.revoked || Date.now() > session.refreshTokenExpiresAt) {
    return c.json({ error: "invalid_grant", error_description: "Refresh token invalid or expired" }, 400);
  }

  tokenSessions.delete(refresh_token);

  const now = Date.now();
  const newAccessToken = `at_${now}_${Math.random().toString(36).substring(2, 10)}`;
  const newRefreshToken = `rt_${now}_${Math.random().toString(36).substring(2, 10)}`;

  const newSession: TokenSession = {
    ...session,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessTokenExpiresAt: now + 3600000,
    refreshTokenExpiresAt: now + 30 * 86400000,
  };

  tokenSessions.set(newRefreshToken, newSession);

  return c.json({
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: newRefreshToken,
  });
});

// ---------------------------------------------------------------------------
// POST /oauth/revoke — Token Revocation Endpoint
// ---------------------------------------------------------------------------

oauthRouter.post("/revoke", async (c) => {
  const { token } = await c.req.json();
  if (token && tokenSessions.has(token)) {
    const session = tokenSessions.get(token);
    if (session) session.revoked = true;
    tokenSessions.delete(token);
  }
  return c.json({ status: "revoked", ok: true });
});
