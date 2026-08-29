/** One button that puts a string on the clipboard and says so. Used across the first run. */
import { useCallback } from "react";
import { copyText } from "../../lib/clipboard";
import { useToast } from "../../Toasts";

export interface CopyButtonProps {
  readonly label: string;
  readonly value: string;
  /** What the toast says once it worked. */
  readonly done: string;
  readonly primary?: boolean;
}

export function CopyButton({ label, value, done, primary = false }: CopyButtonProps): JSX.Element {
  const push = useToast();
  const onCopy = useCallback(async () => {
    const ok = await copyText(value);
    push(ok ? done : "Copy blocked by the browser. Select the text instead.", ok ? "ok" : "warn");
  }, [value, done, push]);

  return (
    <button
      type="button"
      className={primary ? "mfw-btn mfw-btn-primary" : "mfw-btn"}
      onClick={() => void onCopy()}
    >
      {label}
    </button>
  );
}
