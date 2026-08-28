/**
 * Live mode authentication against the Supabase Auth REST API.
 *
 * No SDK, no cookie, no localStorage. The access token lives in a module-scoped
 * variable that is replaced wholesale on every change and dropped on sign-out or
 * on a page reload. It is never written to storage and never put in a URL, so a
 * shared screen, a screenshot of the address bar or a stale tab cannot leak it.
 *
 * Magic link is implemented as "send a one-time code, then verify the code"
 * (/auth/v1/otp then /auth/v1/verify) rather than the redirect flow, because the
 * redirect flow returns the access token in the URL fragment. Same mail, same
 * button, no token in a URL.
 *
 * Configuration comes from Vite env vars, documented in docs/DEPLOY.md:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CLAWAI_API
 */

const DEFAULT_CLAWAI_API = "https://clawai.eu";
const HTTP_TIMEOUT_MS = 15_000;

export interface LiveConfig {
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly apiBase: string;
  readonly configured: boolean;
}

export interface LiveSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Epoch milliseconds. */
  readonly expiresAt: number;
  readonly email?: string;
  readonly userId?: string;
}

export type AuthErrorKind = "config" | "credentials" | "network" | "timeout" | "server";

export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  constructor(kind: AuthErrorKind, message: string) {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function liveConfig(): LiveConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const supabaseUrl = trimSlash(env.VITE_SUPABASE_URL ?? "");
  const anonKey = env.VITE_SUPABASE_ANON_KEY ?? "";
  const apiBase = trimSlash(env.VITE_CLAWAI_API ?? DEFAULT_CLAWAI_API);
  return {
    supabaseUrl,
    anonKey,
    apiBase,
    configured: supabaseUrl.length > 0 && anonKey.length > 0,
  };
}

export function isLiveConfigured(): boolean {
  return liveConfig().configured;
}

/* ---------- in-memory session ---------- */

let session: LiveSession | null = null;
const listeners = new Set<(next: LiveSession | null) => void>();

function setSession(next: LiveSession | null): void {
  session = next;
  listeners.forEach((listener) => listener(next));
}

export function getSession(): LiveSession | null {
  return session;
}

export function getAccessToken(): string | null {
  return session ? session.accessToken : null;
}

export function isSignedIn(): boolean {
  return session !== null && session.expiresAt > Date.now();
}

export function onAuthChange(listener: (next: LiveSession | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ---------- transport ---------- */

/** 15 second budget for every HTTP call. Applies to HTTP only, never to a model call. */
function httpTimeout(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(HTTP_TIMEOUT_MS);
  }
  return undefined;
}

interface TokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly user?: { readonly id?: string; readonly email?: string };
  readonly error_description?: string;
  readonly msg?: string;
  readonly message?: string;
}

function messageFrom(body: TokenResponse, fallback: string): string {
  return body.error_description ?? body.msg ?? body.message ?? fallback;
}

async function authPost(path: string, body: unknown): Promise<TokenResponse> {
  const cfg = liveConfig();
  if (!cfg.configured) {
    throw new AuthError(
      "config",
      "Live mode is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.",
    );
  }
  const signal = httpTimeout();
  let response: Response;
  try {
    response = await fetch(cfg.supabaseUrl + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
      },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new AuthError(
      timedOut ? "timeout" : "network",
      timedOut
        ? "Sign-in timed out after 15 seconds. Check the connection and try again."
        : "Could not reach the sign-in service. Check the connection and try again.",
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new AuthError("credentials", messageFrom(parsed, "Email or password is not correct."));
    }
    throw new AuthError("server", messageFrom(parsed, "Sign-in failed with status " + response.status + "."));
  }
  return parsed;
}

function toSession(body: TokenResponse): LiveSession {
  if (!body.access_token || !body.refresh_token) {
    throw new AuthError("server", "The sign-in service did not return a token.");
  }
  const lifetimeSeconds = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + lifetimeSeconds * 1000,
    ...(body.user?.email ? { email: body.user.email } : {}),
    ...(body.user?.id ? { userId: body.user.id } : {}),
  };
}

/* ---------- public operations ---------- */

/** Email and password sign-in. The safe path inside the ChatGPT desktop browser. */
export async function signInWithPassword(email: string, password: string): Promise<LiveSession> {
  const body = await authPost("/auth/v1/token?grant_type=password", { email, password });
  const next = toSession(body);
  setSession(next);
  return next;
}

/**
 * Ask Supabase to mail a one-time code (the magic-link mail carries both a link
 * and a six digit code). `shouldCreateUser` is false: live mode signs in existing
 * clawai accounts, it does not open new ones.
 */
export async function sendMagicLink(email: string): Promise<void> {
  await authPost("/auth/v1/otp", { email, create_user: false });
}

/** Finish the magic-link flow with the code from the mail. Keeps the token out of the URL. */
export async function verifyMagicLinkCode(email: string, code: string): Promise<LiveSession> {
  const body = await authPost("/auth/v1/verify", { type: "email", email, token: code });
  const next = toSession(body);
  setSession(next);
  return next;
}

/** Exchange the refresh token for a fresh access token. Returns null when there is no session. */
export async function refreshSession(): Promise<LiveSession | null> {
  const current = session;
  if (!current) return null;
  const body = await authPost("/auth/v1/token?grant_type=refresh_token", {
    refresh_token: current.refreshToken,
  });
  const next = toSession(body);
  setSession(next);
  return next;
}

/** Refresh when the token is inside its last two minutes. Best effort: never throws. */
export async function ensureFreshToken(): Promise<string | null> {
  const current = session;
  if (!current) return null;
  if (current.expiresAt - Date.now() > 120_000) return current.accessToken;
  try {
    const next = await refreshSession();
    return next ? next.accessToken : null;
  } catch {
    return current.accessToken;
  }
}

/** Revoke the token server side, then drop it locally whatever happened. */
export async function signOut(): Promise<void> {
  const cfg = liveConfig();
  const current = session;
  setSession(null);
  if (!cfg.configured || !current) return;
  const signal = httpTimeout();
  try {
    await fetch(cfg.supabaseUrl + "/auth/v1/logout", {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + current.accessToken,
      },
      ...(signal ? { signal } : {}),
    });
  } catch {
    // The local token is already gone, which is the part that matters here.
  }
}
