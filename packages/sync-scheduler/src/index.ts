import { loadConfig } from '#config';
import { runSyncOnce } from '#run-sync';
import type { SyncResult } from '#run-sync';

function logResults(results: SyncResult[]) {
  const timestamp = new Date().toISOString();
  for (const result of results) {
    if (result.ok) {
      console.log(`[${timestamp}] synced ${result.syncId}`);
    } else {
      console.error(
        `[${timestamp}] failed to sync ${result.syncId}: ${result.error}`,
      );
    }
  }
}

const SHUTDOWN_GRACE_PERIOD_MS = 30_000;

let inFlightTick: Promise<void> | null = null;

async function tick(config: ReturnType<typeof loadConfig>) {
  const run = (async () => {
    try {
      logResults(await runSyncOnce(config));
    } catch (err) {
      console.error('Unexpected error running the sync cycle:', err);
    }
  })();

  inFlightTick = run;
  try {
    await run;
  } finally {
    if (inFlightTick === run) {
      inFlightTick = null;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const config = loadConfig();

  console.log(
    `Starting background bank sync for ${config.budgets.length} budget(s), ` +
      `every ${config.intervalMinutes} minute(s).`,
  );

  await tick(config);

  const intervalId = setInterval(
    () => void tick(config),
    config.intervalMinutes * 60 * 1000,
  );

  const stop = async () => {
    clearInterval(intervalId);
    // Let an in-flight sync (and its api.shutdown() cleanup) finish before
    // exiting, so SIGTERM (e.g. `docker stop`) doesn't kill the process
    // mid-write and leave a stale lock or corrupted local cache.
    if (inFlightTick) {
      await Promise.race([inFlightTick, delay(SHUTDOWN_GRACE_PERIOD_MS)]);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

void main();
