/**
 * The loop picture: what is running, on whose machine, stacked so everything below feeds
 * the layer above it.
 *
 * The floor is at the bottom and the arrows point up, because that is the sentence the
 * product makes ("everything below feeds the top") and a picture that reads the other way
 * would make a person translate. Clicking a loop opens it and hands over the words to say
 * to the agent that owns it, since there is no chat box here and there should not be.
 */
import { useCallback, useState } from "react";
import { useShell, useWorkspace } from "../../shell/context";
import { copyText } from "../../shell/lib/clipboard";
import { formatRelative } from "../../shell/lib/format";
import { withAudit } from "../../shell/adapters/store";
import { heldName } from "../../agents/identity";
import type { Loop } from "../../types";
import { clampLayer, feedRefusal, findLoop, loopById, putLoop } from "../state";
import { loopRows, pictureLine, saidLine, talkPrompt, whereLine, type LoopRow } from "../view";
import { LiveBand, OutsideBand, WaitingBand, hasSessionContext } from "../../sessions/ui/SessionBands";
import "./loops.css";

function Box({
  row,
  open,
  onOpen,
}: {
  readonly row: LoopRow;
  readonly open: boolean;
  readonly onOpen: () => void;
}): JSX.Element {
  const { loop } = row;
  return (
    <button
      type="button"
      className={`mfw-loop mfw-loop--${loop.state} ${open ? "mfw-loop--open" : ""}`.trim()}
      onClick={onOpen}
      aria-expanded={open}
    >
      <span className="mfw-loop__top">
        <span className="mfw-loop__name">{loop.name}</span>
        <span className={`mfw-loop__state mfw-loop__state--${loop.state}`}>{loop.state}</span>
      </span>
      <span className="mfw-loop__does">{loop.does}</span>
      <span className="mfw-loop__where">
        {whereLine(loop)}
        {row.remote ? <span className="mfw-loop__remote">another machine</span> : null}
      </span>
      <span className="mfw-loop__said">{saidLine(loop)}</span>
      {loop.lastRunAt === undefined ? null : (
        <span className="mfw-loop__when">{formatRelative(loop.lastRunAt)}</span>
      )}
    </button>
  );
}

function Detail({ row, onClose }: { readonly row: LoopRow; readonly onClose: () => void }): JSX.Element {
  const { store } = useShell();
  const workspace = useWorkspace();
  const [note, setNote] = useState<string | null>(null);
  const { loop } = row;

  const onCopy = useCallback(async () => {
    const ok = await copyText(talkPrompt(row));
    setNote(ok ? "Copied. Paste it into your chat." : "Copy blocked by the browser.");
  }, [row]);

  /** Moving a box is the same operation the agent's rearrange_loop performs. */
  const move = useCallback(
    async (delta: number) => {
      const next = clampLayer(loop.layer + delta);
      if (next === loop.layer) return;
      const moved: Loop = { ...loop, layer: next, updatedAt: new Date().toISOString() };
      const refusal = feedRefusal(workspace, moved, moved.feeds);
      if (refusal !== null) {
        setNote(refusal);
        return;
      }
      setNote(null);
      await store.update((ws) =>
        withAudit(putLoop(ws, moved), {
          actor: "human",
          tool: "rearrange_loop",
          args: { loop: loop.id, layer: next },
          result: `"${loop.name}" moved to layer ${next}.`,
        }),
      );
    },
    [loop, store, workspace],
  );

  return (
    <aside className="mfw-loop-detail" aria-label={`${loop.name} detail`}>
      <header className="mfw-loop-detail__head">
        <h3>{loop.name}</h3>
        <button type="button" className="mfw-btn mfw-btn-ghost" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="mfw-loop-detail__does">{loop.does}</p>
      <dl className="mfw-loop-facts">
        <dt>Runs on</dt>
        <dd>{loop.host}</dd>
        <dt>Layer</dt>
        <dd>
          {loop.layer}
          <span className="mfw-loop-move">
            <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => void move(-1)}>
              Down
            </button>
            <button type="button" className="mfw-btn mfw-btn-ghost" onClick={() => void move(1)}>
              Up
            </button>
          </span>
        </dd>
        <dt>Feeds</dt>
        <dd>{row.feedsName ?? "nothing yet"}</dd>
        <dt>Fed by</dt>
        <dd>{row.fedBy.length === 0 ? "nothing yet" : row.fedBy.join(", ")}</dd>
        <dt>Last said</dt>
        <dd>{saidLine(loop)}</dd>
      </dl>

      {loop.records.length === 0 ? null : (
        <ol className="mfw-loop-records">
          {[...loop.records].reverse().map((record) => (
            <li key={`${record.at}-${record.text}`}>
              <span className="mfw-loop-records__when">{formatRelative(record.at)}</span>
              <span className="mfw-loop-records__by">{record.by}</span>
              <span>{record.text}</span>
            </li>
          ))}
        </ol>
      )}

      <h4>{row.remote ? `Ask ${loop.host} to change it` : "Change it"}</h4>
      <p className="mfw-loop-detail__hint">
        {row.remote
          ? "This loop runs on somebody else's machine, so the change goes to their agent as a request. Say it in your own chat."
          : "There is no chat box here. Say this in the chat your agent is already in."}
      </p>
      <code className="mfw-loop-prompt">{talkPrompt(row)}</code>
      <button type="button" className="mfw-btn mfw-btn-primary" onClick={() => void onCopy()}>
        Copy what to say
      </button>
      {note === null ? null : (
        <p className="mfw-loop-detail__note" role="status">
          {note}
        </p>
      )}
    </aside>
  );
}

const EMPTY_PROMPT =
  "On mcpforwork.com, call register_loop for each thing you keep running for me: what it is " +
  "called, what it does, how often, and the layer it sits in (0 is the floor, loops feed " +
  "upward). Then call report_loop after each tick with one line I would want to read.";

function Empty(): JSX.Element {
  const [note, setNote] = useState<string | null>(null);
  return (
    <section className="mfw-card mfw-loops-empty">
      <h2>Nothing is running yet</h2>
      <p>
        A loop is anything that keeps going on somebody&apos;s machine: a scan every ten minutes, a
        nightly build, a watcher. Your agent registers the ones it runs, and everybody here sees
        the same picture: what it does, whose machine it is on, and what it feeds.
      </p>
      <p>Nothing on this page schedules anything. The loop keeps running where it already runs.</p>
      <code className="mfw-loop-prompt">{EMPTY_PROMPT}</code>
      <button
        type="button"
        className="mfw-btn mfw-btn-primary"
        onClick={() => {
          void copyText(EMPTY_PROMPT).then((ok) =>
            setNote(ok ? "Copied. Paste it into your chat." : "Copy blocked by the browser."),
          );
        }}
      >
        Copy the prompt
      </button>
      {note === null ? null : (
        <p className="mfw-pop__note" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

export function LoopsPage(): JSX.Element {
  const workspace = useWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = loopRows(workspace, heldName());

  // A board with sessions attached but nothing placed yet is not empty: the waiting list is
  // exactly the work, and telling somebody "nothing is running" while four of their sessions
  // sit there unruled would be the page contradicting itself.
  if (rows.every((layer) => layer.rows.length === 0) && !hasSessionContext(workspace)) {
    return <Empty />;
  }

  // Top layer first on screen, so the arrows read upward on the page as well as in the model.
  const stacked = [...rows].reverse();
  const open = openId === null ? null : loopById(workspace, openId);
  const openRow = open === null ? null : rows.flatMap((layer) => layer.rows).find((row) => row.loop.id === open.id);

  return (
    <section className="mfw-loops" aria-label="Loops">
      <header className="mfw-loops__head">
        <h2>What is running</h2>
        <p className="mfw-loops__line">{pictureLine(workspace)}</p>
      </header>

      <WaitingBand />

      <div className="mfw-loops__body">
        <div className="mfw-loops__stack">
          <LiveBand />
          {stacked.map((layer) => (
            <div className="mfw-loop-layer" key={layer.layer}>
              <span className="mfw-loop-layer__tag">
                {layer.layer === 0 ? "layer 0, the floor" : `layer ${layer.layer}`}
              </span>
              <div className="mfw-loop-layer__row">
                {layer.rows.length === 0 ? (
                  <span className="mfw-loop-layer__empty">nothing here</span>
                ) : (
                  layer.rows.map((row) => (
                    <Box
                      key={row.loop.id}
                      row={row}
                      open={row.loop.id === openId}
                      onOpen={() => setOpenId(row.loop.id === openId ? null : row.loop.id)}
                    />
                  ))
                )}
              </div>
              {layer.layer === 0 ? null : (
                <span className="mfw-loop-layer__arrow" aria-hidden="true">
                  &#8593; feeds up
                </span>
              )}
            </div>
          ))}
        </div>

        {openRow === undefined || openRow === null ? null : (
          <Detail row={openRow} onClose={() => setOpenId(null)} />
        )}
      </div>

      <OutsideBand />
    </section>
  );
}

export { findLoop };
