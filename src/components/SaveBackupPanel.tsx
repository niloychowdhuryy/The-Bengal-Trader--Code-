import { useEffect, useState } from "react";
import {
  listSaveBackups,
  readSaveBackup,
  restoreSaveBackup,
  type SaveBackupReason,
  type SaveBackupSummary,
} from "../game/storage";

const BACKUP_LABELS: Record<SaveBackupReason, string> = {
  migration: "Before a game update",
  "new-game": "Before a new game",
  "before-restore": "Before the last restore",
};

export function downloadJson(fileName: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function SaveBackupPanel({ onRestored }: { onRestored: () => void }) {
  const [backups, setBackups] = useState<SaveBackupSummary[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listSaveBackups()
      .then((found) => {
        if (active) setBackups(found);
      })
      .catch(() => {
        if (active) setError("Your save backups could not be read.");
      });
    return () => {
      active = false;
    };
  }, []);

  const download = (key: string) => {
    readSaveBackup(key)
      .then((backup) => {
        if (backup) downloadJson(`bengal-trader-${key.replace(/[^a-z0-9]+/gi, "-")}.json`, backup);
      })
      .catch(() => setError("That backup could not be downloaded."));
  };

  const restore = (key: string) => {
    restoreSaveBackup(key)
      .then(onRestored)
      .catch(() => setError("That backup could not be restored. Your game has not changed."));
  };

  return (
    <section className="save-backups" aria-label="Save backups">
      <p>
        The game keeps a copy of your save before an update or a new game. Copies stay on this
        device, so download one if you want it somewhere safe.
      </p>
      {error && <p role="alert">{error}</p>}
      {backups?.length === 0 && <p>No backups yet.</p>}
      {backups?.map((backup) => (
        <article className="save-backup" key={backup.key}>
          <strong>{BACKUP_LABELS[backup.reason]}</strong>
          <span>
            {backup.captainName ?? "Unknown captain"} ·{" "}
            {new Date(backup.createdAt).toLocaleDateString()}
          </span>
          <div className="save-backup-actions">
            <button onClick={() => download(backup.key)}>Download</button>
            {confirming === backup.key ? (
              <>
                <button onClick={() => restore(backup.key)}>
                  Replace my current game with this
                </button>
                <button onClick={() => setConfirming(null)}>Keep my current game</button>
              </>
            ) : (
              <button onClick={() => setConfirming(backup.key)}>Restore</button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
