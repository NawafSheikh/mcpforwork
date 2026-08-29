/**
 * "Your agent": where ChatGPT is, and what to do about it.
 *
 * Outside the ChatGPT desktop browser this page has no agent at all, so the card says
 * that first and then gives the three steps that fix it. Inside it, the only thing left
 * to do is paste a prompt, so that is all it shows.
 */
import { getPrompt, STARTER_ID } from "../../../prompts";
import { useWebmcpStatus } from "../../context";
import {
  AGENT_HEADING,
  AGENT_OFF,
  AGENT_ON,
  CHATGPT_STEPS_NOTE,
  SITE_HOST,
} from "../../lib/constants";
import { CopyButton } from "./CopyButton";

interface Step {
  readonly title: string;
  readonly body: string;
  readonly quote?: string;
}

const STEPS: readonly Step[] = [
  {
    title: "1. Open the ChatGPT desktop browser",
    body: "Pick Work mode at the top, then press Toggle side panel at the top right. That side panel is a browser.",
  },
  {
    title: "2. Load this page in that panel",
    body: "Paste the address there. The address bar should then read Site tools, left of the domain.",
    quote: SITE_HOST,
  },
  {
    title: "3. Ask ChatGPT to build the board",
    body: "Paste the starter prompt into the chat beside the panel and watch this board fill.",
  },
];

function StepList(): JSX.Element {
  return (
    <ol className="mfw-first__steps">
      {STEPS.map((step) => (
        <li className="mfw-first__step" key={step.title}>
          <h3 className="mfw-first__steptitle">{step.title}</h3>
          <p className="mfw-first__stepbody">{step.body}</p>
          {step.quote === undefined ? null : <code className="mfw-first__code">{step.quote}</code>}
        </li>
      ))}
    </ol>
  );
}

export function AgentCard(): JSX.Element {
  const status = useWebmcpStatus();
  const starter = getPrompt(STARTER_ID);

  return (
    <section className="mfw-card mfw-first">
      <h2 className="mfw-first__title">{AGENT_HEADING}</h2>
      <p className="mfw-first__state">{status.available ? AGENT_ON : AGENT_OFF}</p>
      {status.available ? null : (
        <>
          <StepList />
          <p className="mfw-muted mfw-first__note">{CHATGPT_STEPS_NOTE}</p>
        </>
      )}
      <div className="mfw-first__prompt">
        <p className="mfw-first__promptlabel">Starter prompt</p>
        <code className="mfw-first__code">{starter}</code>
        <div className="mfw-first__actions">
          {status.available ? null : (
            <CopyButton
              label="Copy the address"
              value={`https://${SITE_HOST}`}
              done="Address copied."
            />
          )}
          <CopyButton
            label="Copy the starter prompt"
            value={starter}
            done="Starter prompt copied."
            primary
          />
        </div>
      </div>
    </section>
  );
}
