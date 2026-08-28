/**
 * Typed fetch wrapper for the clawai.eu REST API.
 *
 * Every call attaches the in-memory Supabase bearer token, gets a 15 second
 * abort budget (HTTP only), and turns transport and status failures into one
 * LiveError with a message a human can act on. Nothing here throws a bare
 * Response or a raw network error at the caller.
 */
import { ensureFreshToken, liveConfig } from "./auth";

const HTTP_TIMEOUT_MS = 15_000;

export type LiveErrorKind =
  | "config"
  | "auth"
  | "forbidden"
  | "notFound"
  | "badRequest"
  | "rateLimit"
  | "server"
  | "network"
  | "timeout"
  | "parse";

export class LiveError extends Error {
  readonly kind: LiveErrorKind;
  readonly status?: number;
  constructor(kind: LiveErrorKind, message: string, status?: number) {
    super(message);
    this.name = "LiveError";
    this.kind = kind;
    if (typeof status === "number") this.status = status;
  }
}

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  /** Extra abort signal from the caller, for example the WebMCP tool ctx.signal. */
  readonly signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const cfg = liveConfig();
  const base = cfg.apiBase + (path.startsWith("/") ? path : "/" + path);
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const suffix = params.toString();
  return suffix.length > 0 ? base + "?" + suffix : base;
}

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(HTTP_TIMEOUT_MS);
  }
  return undefined;
}

/** Prefer AbortSignal.any when the runtime has it, otherwise fall back to the caller's signal. */
function combineSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  const anyFn = (AbortSignal as unknown as { any?: (list: AbortSignal[]) => AbortSignal }).any;
  return typeof anyFn === "function" ? anyFn([a, b]) : b;
}

function statusKind(status: number): LiveErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimit";
  if (status >= 500) return "server";
  return "badRequest";
}

/** One place that turns a LiveError into a sentence for the audit rail or a tool result. */
export function friendlyMessage(error: unknown): string {
  if (error instanceof LiveError) {
    switch (error.kind) {
      case "config":
        return "Live mode is not configured on this build. Demo mode still works.";
      case "auth":
        return "The clawai session expired. Sign in again from the Live tab.";
      case "forbidden":
        return "That clawai account is not allowed to do this.";
      case "notFound":
        return "clawai does not have that record any more. It may have been deleted.";
      case "rateLimit":
        return "clawai is rate limiting the console. Wait a minute and retry.";
      case "server":
        return "clawai returned a server error. The board kept its local copy.";
      case "network":
        return "Could not reach clawai.eu. The board kept its local copy.";
      case "timeout":
        return "clawai.eu did not answer within 15 seconds. The board kept its local copy.";
      case "parse":
        return "clawai returned something this console could not read.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Unknown failure.";
}

async function errorBodyText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}

/**
 * Perform one authenticated request. `T` is the caller's expected shape; the
 * response is not validated here, so every adapter narrows what it reads.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const cfg = liveConfig();
  if (!cfg.configured) {
    throw new LiveError("config", "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.");
  }
  const token = await ensureFreshToken();
  if (!token) {
    throw new LiveError("auth", "Not signed in to clawai.");
  }
  const signal = combineSignals(timeoutSignal(), options.signal);
  const method = options.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new LiveError(
      timedOut ? "timeout" : "network",
      timedOut ? "Request to clawai timed out." : "Request to clawai failed at the network layer.",
    );
  }

  if (!response.ok) {
    const detail = await errorBodyText(response);
    throw new LiveError(
      statusKind(response.status),
      "clawai " + method + " " + path + " returned " + response.status + (detail ? ": " + detail : ""),
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new LiveError("parse", "clawai returned a body that is not JSON.");
  }
}
