/**
 * Board tab. The implementation lives in ./board (owner A7); this file is the
 * name the shell already imports, and it forwards readOnly for shared snapshots.
 */
import { Board } from "./board";

export interface BoardTabProps {
  readonly readOnly?: boolean;
}

export function BoardTab({ readOnly = false }: BoardTabProps): JSX.Element {
  return <Board readOnly={readOnly} />;
}
