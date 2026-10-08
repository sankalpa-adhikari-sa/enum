import { useCallback, useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdaterStatus =
  | 'idle' // nothing to show
  | 'checking' // asking the endpoint for a newer version
  | 'up-to-date' // manual check found nothing
  | 'available' // update found, not downloaded yet
  | 'downloading' // download in progress
  | 'ready' // downloaded, waiting for the user to restart
  | 'installing' // installing / relaunching
  | 'error';

export interface DownloadProgress {
  downloaded: number;
  /** Total size in bytes, or null if the server didn't send a Content-Length. */
  total: number | null;
}

export interface UseUpdaterOptions {
  /** Check once when the hook mounts. Default: true */
  checkOnMount?: boolean;
  /** Re-check in the background every N milliseconds. Default: off */
  checkIntervalMs?: number;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useUpdater({ checkOnMount = true, checkIntervalMs }: UseUpdaterOptions = {}) {
  const [status, setStatus] = useState<UpdaterStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: null });
  const [error, setError] = useState<string | null>(null);

  // Refs avoid stale closures and let us block overlapping operations.
  const updateRef = useRef<Update | null>(null);
  const busy = useRef(false);

  const fail = useCallback((e: unknown) => {
    console.error('[updater]', e);
    setError(errorMessage(e));
    setStatus('error');
  }, []);

  /**
   * Look for a new version.
   * `silent` checks (mount / interval) never show "checking", "up to date" or errors.
   */
  const checkForUpdates = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (busy.current || updateRef.current) return;
      busy.current = true;
      setError(null);
      if (!silent) setStatus('checking');

      try {
        const result = await check();
        if (result) {
          updateRef.current = result;
          setUpdate(result);
          setStatus('available');
        } else {
          setStatus(silent ? 'idle' : 'up-to-date');
        }
      } catch (e) {
        if (silent) {
          console.error('[updater] background check failed', e);
          setStatus('idle');
        } else {
          fail(e);
        }
      } finally {
        busy.current = false;
      }
    },
    [fail],
  );

  /** Download the update without installing it yet. */
  const downloadUpdate = useCallback(async () => {
    const current = updateRef.current;
    if (!current || busy.current) return;
    busy.current = true;
    setStatus('downloading');
    setProgress({ downloaded: 0, total: null });

    try {
      let downloaded = 0;
      await current.download((event) => {
        switch (event.event) {
          case 'Started':
            setProgress({ downloaded: 0, total: event.data.contentLength ?? null });
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            setProgress((p) => ({ ...p, downloaded }));
            break;
          case 'Finished':
            break;
        }
      });
      setStatus('ready');
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
    }
  }, [fail]);

  /**
   * Install the downloaded update and restart.
   * On Windows the installer exits the app itself, so relaunch() may never run there.
   */
  const installAndRestart = useCallback(async () => {
    const current = updateRef.current;
    if (!current || busy.current) return;
    busy.current = true;
    setStatus('installing');

    try {
      await current.install();
      await relaunch();
    } catch (e) {
      fail(e);
      busy.current = false;
    }
  }, [fail]);

  /** Hide the panel and release the update resource held by Rust. */
  const dismiss = useCallback(() => {
    if (busy.current) return;
    updateRef.current?.close().catch(() => {});
    updateRef.current = null;
    setUpdate(null);
    setError(null);
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (checkOnMount) void checkForUpdates({ silent: true });
  }, [checkOnMount, checkForUpdates]);

  useEffect(() => {
    if (!checkIntervalMs) return;
    const id = window.setInterval(() => void checkForUpdates({ silent: true }), checkIntervalMs);
    return () => window.clearInterval(id);
  }, [checkIntervalMs, checkForUpdates]);

  return {
    status,
    update,
    progress,
    error,
    checkForUpdates,
    downloadUpdate,
    installAndRestart,
    dismiss,
  };
}