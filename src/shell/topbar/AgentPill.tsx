/**
 * The connected agent pill: "Site tools on: 30", or the exact fix when they are not.
 *
 * It is also the one place the room learns that an agent lives in this browser, because
 * the WebMCP status is what "an agent can act here" actually means.
 */
import { useEffect } from "react";
import { getRoomRuntime, usePresence } from "../../rooms";
import { useWebmcpStatus } from "../context";
import { WEBMCP_UNAVAILABLE_TEXT } from "../lib/constants";

export function siteToolsLabel(registered: number): string {
  return `Site tools on: ${registered}`;
}

export function AgentPill(): JSX.Element {
  const status = useWebmcpStatus();
  const presence = usePresence();
  const agent = status.available && status.registered > 0;

  useEffect(() => {
    getRoomRuntime()?.setAgent(agent);
  }, [agent, presence.slug]);

  const text = agent ? siteToolsLabel(status.registered) : WEBMCP_UNAVAILABLE_TEXT;
  return (
    <span className={`mfw-pill mfw-pill-${agent ? "ok" : "warn"}`} title={text}>
      <span className="mfw-dot" aria-hidden="true" />
      {text}
    </span>
  );
}
