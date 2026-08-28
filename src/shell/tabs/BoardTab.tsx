/**
 * Board tab. The implementation lives in ./board (owner A7); this file is the
 * name the shell already imports, and it forwards readOnly for shared snapshots.
 */
import { ReplayHost, SampleRibbon } from "../../onboarding";
import { Board } from "./board";

export interface BoardTabProps {
  readonly readOnly?: boolean;
}

export function BoardTab({ readOnly = false }: BoardTabProps): JSX.Element {
  if (readOnly) return <Board readOnly />;
  return (
    <>
      <SampleRibbon />
      <Board />
      <ReplayHost />
    </>
  );
}
