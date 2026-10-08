/**
 * TEMPLATE — copied from ecoflow-telemetry/src/backend/routes/oauth.ts,
 * generalised and hardened. Mount with `app.route('/', oauth)` and exempt these
 * paths, the icons, and /.well-known/* from requireAuth.
 *
 * Passcode sign-in and a minimal OAuth 2.1 authorization-code flow.
 *
 * Two consumers, one credential:
 *
 *   The dashboard  POST /auth/login with the passcode -> HttpOnly session
 *                  cookie, 400 days (the browser ceiling). Asked for once.
 *
 *   MCP clients    the standard discovery -> /oauth/authorize (a popup that
 *                  asks for the passcode) -> /oauth/token -> an access token,
 *                  also one year.
 *
 * Both mint the same stateless HMAC token; see ../auth.ts.
 *
 * Nothing user-facing names the underlying secret. The page says "passcode".
 */
import { Hono } from 'hono';
import { html, raw } from 'hono/html';
import {
  type AppEnv,
  ACCESS_TOKEN_TTL_SECONDS,
  endSession,
  mintAccessToken,
  mintAuthCode,
  redeemAuthCode,
  startSession,
  verifyPasscode,
} from '@/backend/auth';
import { safeNextPath } from '@/backend/edge-access';

export const oauth = new Hono<AppEnv>();

/** Display name: the PUBLIC_APP_NAME var if the Worker has one, else its hostname. */
function appName(c: { env: unknown; req: { url: string } }): string {
  return (c.env as { PUBLIC_APP_NAME?: string }).PUBLIC_APP_NAME ?? new URL(c.req.url).hostname;
}

// ── the passcode page ────────────────────────────────────────────────────────

interface PageOptions {
  appName: string;
  action: string;
  hidden?: Record<string, string>;
  error?: string;
  subtitle?: string;
  submitLabel?: string;
}

/**
 * Rendered by the Worker rather than by Astro because it has to work before
 * the session exists, and on the OAuth popup origin.
 *
 * `html` from hono escapes interpolated values, so the error text and the
 * hidden field values below cannot inject markup.
 */
function passcodePage(o: PageOptions) {
  const hidden = Object.entries(o.hidden ?? {}).map(
    ([k, v]) => html`<input type="hidden" name="${k}" value="${v}" />`,
  );
  return html`<!doctype html>
    <html lang="en" class="dark">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sign in · ${o.appName}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <style>
          :root { color-scheme: dark; }
          * { box-sizing: border-box; }
          body {
            margin: 0; min-height: 100dvh; display: grid; place-items: center;
            padding: 24px; background: #131313; color: #fafafa;
            font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          .card {
            width: 100%; max-width: 360px; background: #1c1c1c;
            border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 28px;
          }
          .logo { width: 40px; height: 40px; margin-bottom: 18px; }
          h1 { margin: 0 0 6px; font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }
          p.sub { margin: 0 0 22px; font-size: 13.5px; color: #a1a1a1; }
          label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 7px; }
          input[type="password"] {
            width: 100%; padding: 10px 12px; font-size: 15px; color: inherit;
            background: #141414; border: 1px solid rgba(255,255,255,.16);
            border-radius: 9px; outline: none;
          }
          input[type="password"]:focus { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74,222,128,.16); }
          button {
            width: 100%; margin-top: 16px; padding: 10px 12px; font-size: 15px; font-weight: 600;
            color: #06240f; background: #4ade80; border: 0; border-radius: 9px; cursor: pointer;
          }
          button:hover { background: #5ee794; }
          .err {
            margin: 0 0 16px; padding: 9px 11px; font-size: 13px; border-radius: 9px;
            color: #fecaca; background: rgba(239,68,68,.13); border: 1px solid rgba(239,68,68,.3);
          }
          .foot { margin: 18px 0 0; font-size: 12px; color: #7d7d7d; text-align: center; }
        </style>
      </head>
      <body>
        <main class="card">
          <img class="logo" src="/logo.svg" alt="" />
          <h1>${o.appName}</h1>
          <p class="sub">${o.subtitle ?? 'Enter the passcode to continue.'}</p>
          ${o.error ? html`<p class="err">${o.error}</p>` : ''}
          <form method="post" action="${o.action}">
            ${hidden}
            <label for="passcode">Passcode</label>
            <input
              id="passcode" name="passcode" type="password" required autofocus
              autocomplete="current-password" placeholder="••••••••••••"
            />
            <button type="submit">${o.submitLabel ?? 'Sign in'}</button>
          </form>
          <p class="foot">You will not be asked again on this device for over a year.</p>
        </main>
      </body>
    </html>`;
}

// ── dashboard session ────────────────────────────────────────────────────────

oauth.get('/login', (c) =>
  c.html(passcodePage({
        appName: appName(c), action: '/auth/login', hidden: { next: c.req.query('next') ?? '/' } })),
);

oauth.post('/auth/login', async (c) => {
  const form = await c.req.parseBody();
  const passcode = String(form.passcode ?? '');
  const next = safeNextPath(form.next);

  if (!(await verifyPasscode(c.env, passcode))) {
    // 401 rather than a redirect so a wrong passcode cannot be replayed as a
    // successful navigation in the browser's history.
    return c.html(
      passcodePage({
        appName: appName(c),
        action: '/auth/login',
        hidden: { next },
        error: 'That passcode is not right.',
      }),
      401,
    );
  }

  await startSession(c);
  return c.redirect(next, 303);
});

oauth.post('/auth/logout', (c) => {
  endSession(c);
  return c.redirect('/login', 303);
});

// ── OAuth discovery ──────────────────────────────────────────────────────────

oauth.get('/.well-known/oauth-authorization-server', (c) => {
  const base = new URL(c.req.url).origin;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['telemetry:read'],
  });
});

oauth.get('/.well-known/oauth-protected-resource', (c) => {
  const base = new URL(c.req.url).origin;
  return c.json({
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
    scopes_supported: ['telemetry:read'],
  });
});

/**
 * Dynamic client registration.
 *
 * There is nothing to register against: every client authenticates with the
 * same passcode at /oauth/authorize, and tokens are stateless. Accepting the
 * call and echoing an id keeps MCP clients that require RFC 7591 happy without
 * inventing a client store that would only ever hold throwaway rows.
 */
oauth.post('/oauth/register', async (c) => {
  const body = await c.req
    .json<Record<string, unknown>>()
    .catch((): Record<string, unknown> => ({}));
  return c.json(
    {
      client_id: `mcp-${crypto.randomUUID()}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
      client_name: typeof body.client_name === 'string' ? body.client_name : 'MCP client',
    },
    201,
  );
});

// ── authorization code flow ──────────────────────────────────────────────────

/** https anywhere; plain http only to loopback, which is where CLI clients listen. */
function isUsableRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Registration is stateless, so anyone can mint a client with any redirect_uri.
 * PKCE alone does not stop a phishing link (the attacker makes their own
 * verifier). What does: the page names the host that will receive the grant, so
 * the person typing the passcode sees "connect evil.example" before they do.
 */
function connectingTo(redirectUri: string): string {
  return `Enter the passcode to connect ${new URL(redirectUri).host}. It stays connected for one year.`;
}

oauth.get('/oauth/authorize', (c) => {
  const q = c.req.query();
  if (!q.redirect_uri || !isUsableRedirect(q.redirect_uri)) {
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri is missing or unusable' }, 400);
  }
  if (q.response_type && q.response_type !== 'code') {
    return c.json({ error: 'unsupported_response_type' }, 400);
  }
  if (!q.code_challenge || q.code_challenge_method !== 'S256') {
    return c.json({ error: 'invalid_request', error_description: 'PKCE with S256 is required' }, 400);
  }
  return c.html(
    passcodePage({
        appName: appName(c),
      action: '/oauth/authorize',
      subtitle: connectingTo(q.redirect_uri),
      submitLabel: 'Authorize',
      hidden: {
        redirect_uri: q.redirect_uri,
        state: q.state ?? '',
        code_challenge: q.code_challenge ?? '',
        code_challenge_method: q.code_challenge_method ?? '',
      },
    }),
  );
});

oauth.post('/oauth/authorize', async (c) => {
  const form = await c.req.parseBody();
  const redirectUri = String(form.redirect_uri ?? '');
  const state = String(form.state ?? '');
  const challenge = String(form.code_challenge ?? '');
  const method = String(form.code_challenge_method ?? '');

  if (!isUsableRedirect(redirectUri)) {
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri is unusable' }, 400);
  }
  if (!challenge || method !== 'S256') {
    return c.json({ error: 'invalid_request', error_description: 'PKCE with S256 is required' }, 400);
  }
  if (!(await verifyPasscode(c.env, String(form.passcode ?? '')))) {
    return c.html(
      passcodePage({
        appName: appName(c),
        action: '/oauth/authorize',
        subtitle: connectingTo(redirectUri),
        submitLabel: 'Authorize',
        error: 'That passcode is not right.',
        hidden: {
          redirect_uri: redirectUri,
          state,
          code_challenge: challenge,
          code_challenge_method: method,
        },
      }),
      401,
    );
  }

  const target = new URL(redirectUri);
  target.searchParams.set('code', await mintAuthCode(c.env, challenge));
  if (state) target.searchParams.set('state', state);
  return c.redirect(target.toString(), 303);
});

oauth.post('/oauth/token', async (c) => {
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const grantType = String(form.grant_type ?? '');
  if (grantType !== 'authorization_code') {
    return c.json({ error: 'unsupported_grant_type' }, 400);
  }

  const redeemed = await redeemAuthCode(
    c.env,
    String(form.code ?? ''),
    form.code_verifier ? String(form.code_verifier) : undefined,
  );
  if (!redeemed.ok) {
    return c.json({ error: 'invalid_grant', error_description: redeemed.reason }, 400);
  }

  return c.json(
    {
      access_token: await mintAccessToken(c.env),
      token_type: 'Bearer',
      // A full year, honoured literally: the token carries its own signed
      // expiry, so nothing downstream can quietly shorten it.
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: 'mcp',
    },
    200,
    { 'Cache-Control': 'no-store' },
  );
});

export { raw };
