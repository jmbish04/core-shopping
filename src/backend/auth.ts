/**
 * TEMPLATE — copied from ecoflow-telemetry/src/backend/auth.ts (verified live
 * 2026-09-10), generalised, with the fixes noted below. Copy into
 * src/backend/auth.ts and pair it with ../routes/oauth.ts.
 *
 * Authentication for the API, the MCP server, and the dashboard.
 *
 * One shared secret backs all three: the Secret Store binding WORKER_API_KEY.
 * Three ways to present it, all equivalent:
 *
 *   Authorization: Bearer <key>     machine callers (scripts, other Workers)
 *   Authorization: Bearer <token>   OAuth access token minted by /oauth/token
 *   Cookie: session=<token>         the dashboard, after the passcode prompt
 *
 * The UI never names the secret. It asks for a "passcode", because a label that
 * tells a stranger which credential they are guessing is a gift to them.
 *
 * Tokens are STATELESS: an HMAC over their own expiry, keyed by WORKER_API_KEY.
 * There is no server-side session table to grow, and rotating WORKER_API_KEY
 * invalidates every outstanding token at once — which is the behaviour you want
 * from a rotation. The corollary is that a token cannot be revoked
 * individually; rotate the key if one leaks.
 *
 * Lifetimes: OAuth access tokens 365 days; the dashboard session cookie 400
 * days, which is the most any browser will keep a cookie (RFC 6265bis; Chrome
 * clamps anything longer), so a user signs in once per device.
 *
 * Changes from the original: PKCE S256 is REQUIRED (it was optional, so an
 * attacker-crafted authorize link could obtain a year-long token); session TTL
 * split from the OAuth TTL; the cookie name is no longer hardcoded twice.
 *
 * The one-year lifetime is real here. @cloudflare/workers-oauth-provider caps
 * grants at its own clientRegistrationTTL (90 days by default) no matter what
 * lifetime you configure — a trap this hand-rolled flow simply does not have.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { requireSecret } from '@/backend/utils/secrets';

export const SESSION_COOKIE = 'session';
export const ACCESS_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year, OAuth
export const SESSION_TTL_SECONDS = 400 * 24 * 60 * 60; // browser ceiling for cookies
const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes, per OAuth guidance

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** How the caller authenticated. Surfaced on /api/whoami, handy in logs. */
    authMethod: 'bearer-key' | 'bearer-token' | 'cookie';
  };
}

// ── primitives ───────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, payload: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
  return b64url(sig);
}

/**
 * Constant-time string comparison.
 *
 * `a === b` on a secret leaks its length and its matching prefix through timing.
 * The XOR-accumulate below always walks the full width of the longer input.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

// ── tokens ───────────────────────────────────────────────────────────────────

type TokenKind = 'access' | 'code';

/** `<kind>.<expiryEpochSeconds>.<extra>.<signature>` */
async function mintToken(
  secret: string,
  kind: TokenKind,
  ttlSeconds: number,
  extra = '-',
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${kind}.${exp}.${extra}`;
  return `${body}.${await sign(secret, body)}`;
}

async function readToken(
  secret: string,
  token: string,
  kind: TokenKind,
): Promise<{ valid: boolean; extra?: string }> {
  const parts = token.split('.');
  if (parts.length !== 4) return { valid: false };
  const [tokenKind, expRaw, extra, signature] = parts;
  if (tokenKind !== kind) return { valid: false };

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return { valid: false };

  const expected = await sign(secret, `${tokenKind}.${expRaw}.${extra}`);
  if (!timingSafeEqual(expected, signature)) return { valid: false };
  return { valid: true, extra };
}

export async function mintAccessToken(env: Env, ttlSeconds = ACCESS_TOKEN_TTL_SECONDS): Promise<string> {
  return mintToken(await requireSecret(env, 'WORKER_API_KEY'), 'access', ttlSeconds);
}

/** The authorization code carries the PKCE challenge so /oauth/token can check it. */
export async function mintAuthCode(env: Env, codeChallenge: string): Promise<string> {
  return mintToken(
    await requireSecret(env, 'WORKER_API_KEY'),
    'code',
    AUTH_CODE_TTL_SECONDS,
    codeChallenge || '-',
  );
}

export async function redeemAuthCode(
  env: Env,
  code: string,
  codeVerifier: string | undefined,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = await requireSecret(env, 'WORKER_API_KEY');
  const result = await readToken(secret, code, 'code');
  if (!result.valid) return { ok: false, reason: 'authorization code is invalid or expired' };

  const challenge = result.extra ?? '-';
  // PKCE is mandatory (OAuth 2.1). A code minted without a challenge is refused.
  if (challenge === '-') return { ok: false, reason: 'PKCE code_challenge is required' };

  if (!codeVerifier) return { ok: false, reason: 'code_verifier is required' };
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  if (!timingSafeEqual(b64url(digest), challenge)) {
    return { ok: false, reason: 'code_verifier does not match code_challenge' };
  }
  return { ok: true };
}

// ── the passcode ─────────────────────────────────────────────────────────────

export async function verifyPasscode(env: Env, candidate: string): Promise<boolean> {
  if (!candidate) return false;
  return timingSafeEqual(candidate, await requireSecret(env, 'WORKER_API_KEY'));
}

export async function startSession(c: Context<AppEnv>): Promise<void> {
  const token = await mintAccessToken(c.env, SESSION_TTL_SECONDS);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/** True if this request already carries a valid session cookie. */
export async function hasValidSession(env: Env, request: Request): Promise<boolean> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
  if (!match) return false;
  const secret = await requireSecret(env, 'WORKER_API_KEY');
  return (await readToken(secret, decodeURIComponent(match[1]), 'access')).valid;
}

// ── middleware ───────────────────────────────────────────────────────────────

function bearerFrom(c: Context<AppEnv>): string | undefined {
  const header = c.req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return c.req.header('x-api-key')?.trim();
}

/**
 * Gate for /api/* and /mcp.
 *
 * Order matters only for the label we record; any one of the three is enough.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const secret = await requireSecret(c.env, 'WORKER_API_KEY');

  const presented = bearerFrom(c);
  if (presented) {
    if (timingSafeEqual(presented, secret)) {
      c.set('authMethod', 'bearer-key');
      return next();
    }
    if ((await readToken(secret, presented, 'access')).valid) {
      c.set('authMethod', 'bearer-token');
      return next();
    }
  }

  const cookie = getCookie(c, SESSION_COOKIE);
  if (cookie && (await readToken(secret, cookie, 'access')).valid) {
    c.set('authMethod', 'cookie');
    return next();
  }

  // WWW-Authenticate with resource_metadata is what makes an MCP client start
  // the OAuth dance instead of just giving up on the 401.
  const base = new URL(c.req.url).origin;
  return c.json(
    { error: 'unauthorized', message: 'Provide a passcode, or sign in from the dashboard.' },
    401,
    {
      'WWW-Authenticate': `Bearer realm="${new URL(base).hostname}", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
    },
  );
};
