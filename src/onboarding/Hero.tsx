/**
 * The first thing a stranger sees on an empty board.
 *
 * It answers three questions above the fold: what this page is, what to do, and what will
 * happen. It branches on the WebMCP status, because the answer is different depending on
 * whether an agent is already on the other end of this page.
 */
import { useCallback } from "react";
import { seedSampleWorkspace } from "../shell/adapters/demo";
import { useShell, useWebmcpStatus } from "../shell/context";
import { useToast } from "../shell/Toasts";
import { copyText } from "../shell/lib/clipboard";
import { CHATGPT_STEPS_NOTE } from "../shell/lib/constants";
/** getPrompt returns the visitor's own edit of the shipped prompt, not the constant. */
import { getPrompt, STARTER_ID } from "../prompts";
import { replayController } from "./replayController";
import "./onboarding.css";

export const SITE_URL = "mcpforwork.com";
export const REPLAY_LABEL = "Watch it build (50 seconds)";
export const HERO_TITLE = "A workbench for your ChatGPT";
export const HERO_TITLE_LIVE = "Your agent is connected";

const HERO_LEAD =
  "You do not use this page directly. Open it inside ChatGPT desktop, and your ChatGPT " +
  "builds live dashboards here from your mail, files and tickets, under rules you set.";

function useCopyAction(): (value: string, done: string) => Promise<void> {
  const push = useToast();
  return useCallback(
    async (value: string, done: string) => {
      const ok = await copyText(value);
      push(ok ? done : "Copy blocked by the browser. Select the text instead.", ok ? "ok" : "warn");
    },
    [push],
  );
}

interface CopyBit {
  readonly label: string;
  readonly value: string;
  readonly done: string;
}

function CopyButton({ bit }: { readonly bit: CopyBit }): JSX.Element {
  const copy = useCopyAction();
  return (
    <button type="button" className="mfw-btn mfw-hero-copy" onClick={() => void copy(bit.value, bit.done)}>
      {bit.label}
    </button>
  );
}

interface HeroStepProps {
  readonly title: string;
  readonly body: string;
  readonly quote?: string;
  readonly copy?: CopyBit;
}

function HeroStep({ title, body, quote, copy }: HeroStepProps): JSX.Element {
  return (
    <li className="mfw-hero-step">
      <h2 className="mfw-hero-step-title">{title}</h2>
      <p className="mfw-hero-step-body">{body}</p>
      {quote ? <code className="mfw-hero-code">{quote}</code> : null}
      {copy ? <CopyButton bit={copy} /> : null}
    </li>
  );
}

/** The two things a visitor can do right now, without leaving the page. */
function HeroActions({ compact = false }: { readonly compact?: boolean }): JSX.Element {
  const { store } = useShell();
  const push = useToast();

  const onReplay = useCallback(() => replayController.request(store), [store]);
  const onSample = useCallback(async () => {
    await seedSampleWorkspace(store);
    push("Example board loaded. Every number in it is synthetic.", "ok");
  }, [store, push]);

  const primary = compact ? "mfw-btn" : "mfw-btn mfw-btn-primary";
  return (
    <div className="mfw-hero-actions">
      <button type="button" className={primary} onClick={onReplay}>
        {REPLAY_LABEL}
      </button>
      <button type="button" className="mfw-btn" onClick={() => void onSample()}>
        See a finished example
      </button>
    </div>
  );
}

/** Normal browser: nothing is connected, so the whole job is getting there. */
function SetupHero(): JSX.Element {
  const starter = getPrompt(STARTER_ID);
  return (
    <section className="mfw-hero">
      <p className="mfw-hero-eyebrow">Empty on purpose. Your agent fills it.</p>
      <h1 className="mfw-hero-title">{HERO_TITLE}</h1>
      <p className="mfw-hero-lead">{HERO_LEAD}</p>
      <ol className="mfw-hero-steps">
        <HeroStep
          title="1. Open the ChatGPT desktop browser"
          body="Pick Work mode at the top, then press Toggle side panel at the top right. That side panel is a browser."
        />
        <HeroStep
          title="2. Load this page in that panel"
          body="Paste the address there. The address bar should then read Site tools, left of the domain."
          quote={SITE_URL}
          copy={{ label: "Copy the address", value: `https://${SITE_URL}`, done: "Address copied." }}
        />
        <HeroStep
          title="3. Ask ChatGPT to build the board"
          body="Paste the starter prompt into the chat beside the panel, then watch this board build itself."
          quote={starter}
          copy={{ label: "Copy the starter prompt", value: starter, done: "Starter prompt copied." }}
        />
      </ol>
      <p className="mfw-hero-note">{CHATGPT_STEPS_NOTE}</p>
      <HeroActions />
    </section>
  );
}

/** Inside ChatGPT: the tools are live, so the only thing left is the prompt. */
function ConnectedHero({ registered }: { readonly registered: number }): JSX.Element {
  const copy = useCopyAction();
  const starter = getPrompt(STARTER_ID);
  return (
    <section className="mfw-hero">
      <p className="mfw-hero-eyebrow">This page is now a tool your ChatGPT can call.</p>
      <h1 className="mfw-hero-title">{HERO_TITLE_LIVE}</h1>
      <p className="mfw-hero-pill">
        <span className="mfw-dot" aria-hidden="true" />
        Site tools on: {registered} registered
      </p>
      <div className="mfw-hero-card">
        <p className="mfw-hero-card-label">Starter prompt</p>
        <code className="mfw-hero-code mfw-hero-code-big">{starter}</code>
        <button
          type="button"
          className="mfw-btn mfw-btn-primary mfw-hero-copy-big"
          onClick={() => void copy(starter, "Starter prompt copied.")}
        >
          Copy the starter prompt
        </button>
      </div>
      <p className="mfw-hero-lead">Paste it into the chat beside this page.</p>
      <HeroActions compact />
    </section>
  );
}

export function Hero(): JSX.Element {
  const status = useWebmcpStatus();
  return status.available ? <ConnectedHero registered={status.registered} /> : <SetupHero />;
}
