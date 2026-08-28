/**
 * DropZone (owner A11): drop a CSV or XLSX on the board and the agent gets a profile.
 *
 * The file is read with FileReader and parsed here. Nothing is uploaded, nothing is
 * written to IndexedDB, nothing reaches the Workspace. The rows sit in a Map that dies
 * with the tab, and the line under the zone says exactly that, because that promise is
 * the whole point of the feature.
 */

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { datasetMemory, type DatasetRegistry } from "../memory";
import { DatasetFileError, parseFile, type ParseProgress } from "../parse";
import { DATASET_LIMITS, type DatasetProfile } from "../types";
import { ProfileCard } from "./ProfileCard";
import { useDatasets } from "./useDatasets";
import "./dataset.css";

const PHASE_LABELS: Readonly<Record<ParseProgress["phase"], string>> = {
  reading: "Reading the file",
  parsing: "Parsing rows",
  profiling: "Profiling columns",
  done: "Done",
};

const PRIVACY_LINE =
  "Rows stay in this browser. Only the profile and the aggregates you ask for are visible to the agent, and the file is gone when you close the tab.";

const CAP_LINE = `CSV or XLSX, up to ${DATASET_LIMITS.maxBytes / 1_000_000} MB or ${DATASET_LIMITS.maxRows.toLocaleString("en-GB")} rows.`;

const unexpected = (error: unknown): string =>
  error instanceof DatasetFileError
    ? error.message
    : `That file could not be read: ${error instanceof Error ? error.message : String(error)}`;

export interface DropZoneProps {
  /** Injected in tests; the page always uses the one shared in-memory registry. */
  readonly registry?: DatasetRegistry;
  readonly onLoaded?: (profile: DatasetProfile) => void;
}

export function DropZone({ registry = datasetMemory, onLoaded }: DropZoneProps): JSX.Element {
  const profiles = useDatasets(registry);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ingest = useCallback(
    async (file: File): Promise<void> => {
      setError(null);
      setProgress({ phase: "reading", ratio: 0, rows: 0 });
      try {
        const loaded = await parseFile(file, { onProgress: setProgress });
        registry.put(loaded);
        onLoaded?.(loaded.profile);
      } catch (caught) {
        setError(unexpected(caught));
      } finally {
        setProgress(null);
      }
    },
    [registry, onLoaded],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void ingest(file);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void ingest(file);
  };

  return (
    <section className="mfw-ds" aria-label="Drop a file">
      <div
        className={dragging ? "mfw-ds__zone mfw-ds__zone-over" : "mfw-ds__zone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="mfw-ds__headline">Drop a CSV or XLSX here</p>
        <p className="mfw-ds__sub">{CAP_LINE}</p>
        <button
          type="button"
          className="mfw-ds__pick"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
        >
          Choose a file
        </button>
        <input
          ref={inputRef}
          className="mfw-ds__input"
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls"
          aria-label="Choose a CSV or XLSX file"
          onChange={onPick}
        />
      </div>

      <p className="mfw-ds__privacy">{PRIVACY_LINE}</p>

      {progress ? (
        <div className="mfw-ds__progress" role="status">
          <div className="mfw-ds__bar">
            <span className="mfw-ds__bar-fill" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
          <span className="mfw-ds__progress-text">
            {progress.rows > 0
              ? `${PHASE_LABELS[progress.phase]} · ${progress.rows.toLocaleString("en-GB")} rows`
              : PHASE_LABELS[progress.phase]}
          </span>
        </div>
      ) : null}

      {error ? (
        <p className="mfw-ds__error" role="alert">
          {error}
        </p>
      ) : null}

      {profiles.length > 0 ? (
        <div className="mfw-ds__list">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onForget={(name) => registry.forget(name)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
