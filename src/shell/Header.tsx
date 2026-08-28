/** Page header: identity, mode, theme, WebMCP status, sharing and the starter actions. */
import { useCallback, useEffect, useRef, useState } from "react";
import { buildShareUrl } from "../share";
import { seedSampleWorkspace } from "./adapters/demo";
import type { WebmcpStatus } from "./adapters/webmcp";
import { useShell, useWebmcpStatus, useWorkspace } from "./context";
import { useToast } from "./Toasts";
import { copyText } from "./lib/clipboard";
import { currentTheme, setTheme, type Theme } from "./lib/theme";
import { CHATGPT_STEPS, CHATGPT_STEPS_NOTE, STARTER_PROMPT, WEBMCP_UNAVAILABLE_TEXT } from "./lib/constants";

const COPIED_MS = 2000;

function statusText(status: WebmcpStatus): string {
  if (!status.available) return WEBMCP_UNAVAILABLE_TEXT;
  return `Site tools on: ${status.registered} registered`;
}

function StatusPill({ status }: { readonly status: WebmcpStatus }): JSX.Element {
  const tone = status.available ? "ok" : "warn";
  return (
    <span className={`mfw-pill mfw-pill-${tone}`} title={statusText(status)}>
      <span className="mfw-dot" aria-hidden="true" />
      {statusText(status)}
    </span>
  );
}

function ThemeToggle(): JSX.Element {
  const [theme, setLocal] = useState<Theme>(() => currentTheme());
  const onToggle = useCallback(() => {
    setLocal(setTheme(theme === "dark" ? "light" : "dark"));
  }, [theme]);
  return (
    <button
      type="button"
      className="mfw-btn mfw-theme-toggle"
      aria-label="Switch theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{theme === "dark" ? "\u2600" : "\u263D"}</span>
    </button>
  );
}

/** The path to the built-in browser, as measured in the desktop app on 28 Aug 2026. */
function ChatGptPopover(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="mfw-share-wrap"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="mfw-btn"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Open in ChatGPT
      </button>
      {open ? (
        <div className="mfw-share-pop">
          <h4>Where the built-in browser hides</h4>
          <ol>
            {CHATGPT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mfw-share-pop-note">{CHATGPT_STEPS_NOTE}</p>
        </div>
      ) : null}
    </span>
  );
}

interface ShareNote {
  readonly ok: boolean;
  readonly text: string;
}

/** Share: the whole board into the URL fragment, copied to the clipboard. */
function ShareButton(): JSX.Element {
  const workspace = useWorkspace();
  const [note, setNote] = useState<ShareNote | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const onShare = useCallback(async () => {
    if (timer.current !== null) clearTimeout(timer.current);
    try {
      const url = await buildShareUrl(workspace);
      const copied = await copyText(url);
      setNote({ ok: copied, text: copied ? "Link copied" : "Copy blocked by the browser" });
      if (copied) {
        timer.current = setTimeout(() => setNote(null), COPIED_MS);
      }
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? error.message : "Share failed" });
    }
  }, [workspace]);

  return (
    <>
      <button type="button" className="mfw-btn" onClick={onShare}>
        Share
      </button>
      {note !== null ? (
        <span className={note.ok ? "mfw-muted" : "mfw-share-error"} role="status">
          {note.text}
        </span>
      ) : null}
    </>
  );
}

function HeaderActions(): JSX.Element {
  const { store } = useShell();
  const workspace = useWorkspace();
  const status = useWebmcpStatus();
  const push = useToast();

  const onCopy = useCallback(async () => {
    const ok = await copyText(STARTER_PROMPT);
    push(
      ok ? "Starter prompt copied. Paste it into ChatGPT." : "Copy blocked. Select the prompt on the Board tab.",
      ok ? "ok" : "warn",
    );
  }, [push]);

  const onSample = useCallback(async () => {
    await seedSampleWorkspace(store);
    push("Sample workspace loaded. Everything here is synthetic.", "ok");
  }, [store, push]);

  return (
    <>
      <StatusPill status={status} />
      <ShareButton />
      <ChatGptPopover />
      {workspace.mode === "demo" ? (
        <button type="button" className="mfw-btn" onClick={onSample}>
          Load sample workspace
        </button>
      ) : null}
      <button type="button" className="mfw-btn mfw-btn-primary" onClick={onCopy}>
        Copy starter prompt
      </button>
    </>
  );
}

/** `snapshot` is a shared read-only board: no tools, no seeding, no sharing on. */
export function Header({ snapshot = false }: { readonly snapshot?: boolean }): JSX.Element {
  const workspace = useWorkspace();
  return (
    <header className="mfw-header">
      <div className="mfw-brand">
        <span className="mfw-mark" aria-hidden="true">MW</span>
        <span className="mfw-wordmark">MCP for Work</span>
        <span className={`mfw-badge mfw-badge-${snapshot ? "demo" : workspace.mode}`}>
          {snapshot ? "Snapshot" : workspace.mode === "demo" ? "Local · this browser only" : "Live"}
        </span>
      </div>
      <div className="mfw-header-right">
        <ThemeToggle />
        {snapshot ? null : <HeaderActions />}
      </div>
    </header>
  );
}
