import { useUpdater } from '../hooks/useUpdater';
import './Updater.css';

interface UpdaterProps {
  /** Check for updates when the app starts. Default: true */
  checkOnMount?: boolean;
  /** Re-check in the background every N milliseconds. Default: off */
  checkIntervalMs?: number;
  /** Render a "Check for updates" button (e.g. for a settings page). Default: false */
  showCheckButton?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Updater({
  checkOnMount = true,
  checkIntervalMs,
  showCheckButton = false,
}: UpdaterProps) {
  const {
    status,
    update,
    progress,
    error,
    checkForUpdates,
    downloadUpdate,
    installAndRestart,
    dismiss,
  } = useUpdater({ checkOnMount, checkIntervalMs });

  const percent =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  const working = status === 'checking' || status === 'downloading' || status === 'installing';

  return (
    <>
      {showCheckButton && (
        <button
          type="button"
          className="updater-btn"
          disabled={working}
          onClick={() => checkForUpdates()}
        >
          Check for updates
        </button>
      )}

      {status !== 'idle' && (
        <section className="updater" role="status" aria-live="polite">
          {status === 'checking' && <p className="updater-title">Checking for updates…</p>}

          {status === 'up-to-date' && (
            <>
              <p className="updater-title">You’re up to date</p>
              <div className="updater-actions">
                <button type="button" className="updater-btn" onClick={dismiss}>
                  Close
                </button>
              </div>
            </>
          )}

          {status === 'available' && update && (
            <>
              <p className="updater-title">Version {update.version} is available</p>
              {update.body && <pre className="updater-notes">{update.body}</pre>}
              <div className="updater-actions">
                <button type="button" className="updater-btn" onClick={dismiss}>
                  Not now
                </button>
                <button
                  type="button"
                  className="updater-btn updater-btn-primary"
                  onClick={downloadUpdate}
                >
                  Download update
                </button>
              </div>
            </>
          )}

          {status === 'downloading' && (
            <>
              <p className="updater-title">Downloading update…</p>
              <progress
                className="updater-progress"
                max={100}
                value={percent ?? undefined}
                aria-label="Download progress"
              />
              <p className="updater-meta">
                {percent !== null && progress.total
                  ? `${percent}% — ${formatBytes(progress.downloaded)} of ${formatBytes(progress.total)}`
                  : formatBytes(progress.downloaded)}
              </p>
            </>
          )}

          {status === 'ready' && (
            <>
              <p className="updater-title">Update downloaded</p>
              <p className="updater-meta">Restart the app to finish installing it.</p>
              <div className="updater-actions">
                <button type="button" className="updater-btn" onClick={dismiss}>
                  Later
                </button>
                <button
                  type="button"
                  className="updater-btn updater-btn-primary"
                  onClick={installAndRestart}
                >
                  Restart and install
                </button>
              </div>
            </>
          )}

          {status === 'installing' && <p className="updater-title">Installing update…</p>}

          {status === 'error' && (
            <>
              <p className="updater-title">Update failed</p>
              <p className="updater-meta">{error}</p>
              <div className="updater-actions">
                <button type="button" className="updater-btn" onClick={dismiss}>
                  Close
                </button>
                <button
                  type="button"
                  className="updater-btn updater-btn-primary"
                  onClick={() => (update ? downloadUpdate() : checkForUpdates())}
                >
                  Try again
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}