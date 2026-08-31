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

async function tick(config: ReturnType<typeof loadConfig>) {
  try {
    logResults(await runSyncOnce(config));
  } catch (err) {
    console.error('Unexpected error running the sync cycle:', err);
  }
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

  const stop = () => {
    clearInterval(intervalId);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

void main();
