/** Page header: identity, mode, WebMCP status and the two starter actions. */
import { useCallback } from "react";
import { seedSampleWorkspace } from "./adapters/demo";
import type { WebmcpStatus } from "./adapters/webmcp";
import { useShell, useWebmcpStatus, useWorkspace } from "./context";
import { useToast } from "./Toasts";
import { copyText } from "./lib/clipboard";
import { STARTER_PROMPT, WEBMCP_UNAVAILABLE_TEXT } from "./lib/constants";

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

export function Header(): JSX.Element {
  const { store } = useShell();
  const status = useWebmcpStatus();
  const workspace = useWorkspace();
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
    <header className="mfw-header">
      <div className="mfw-brand">
        <span className="mfw-mark" aria-hidden="true">MW</span>
        <span className="mfw-wordmark">MCP for Work</span>
        <span className={`mfw-badge mfw-badge-${workspace.mode}`}>
          {workspace.mode === "demo" ? "Demo" : "Live"}
        </span>
      </div>
      <div className="mfw-header-right">
        <StatusPill status={status} />
        {workspace.mode === "demo" ? (
          <button type="button" className="mfw-btn" onClick={onSample}>
            Load sample workspace
          </button>
        ) : null}
        <button type="button" className="mfw-btn mfw-btn-primary" onClick={onCopy}>
          Copy starter prompt
        </button>
      </div>
    </header>
  );
}
