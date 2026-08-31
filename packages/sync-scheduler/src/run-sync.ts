import * as api from '@actual-app/api';

import type { BudgetConfig, SchedulerConfig } from '#config';

export type SyncResult = {
  syncId: string;
  ok: boolean;
  error?: string;
};

export async function runSyncOnce(
  config: SchedulerConfig,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const budget of config.budgets) {
    results.push(await syncOneBudget(config, budget));
  }

  return results;
}

async function syncOneBudget(
  config: SchedulerConfig,
  budget: BudgetConfig,
): Promise<SyncResult> {
  try {
    if (config.sessionToken) {
      await api.init({
        serverURL: config.serverURL,
        sessionToken: config.sessionToken,
        dataDir: config.dataDir,
      });
    } else {
      await api.init({
        serverURL: config.serverURL,
        password: config.password!,
        dataDir: config.dataDir,
      });
    }

    await api.downloadBudget(budget.syncId, { password: budget.password });
    await api.runBankSync();

    return { syncId: budget.syncId, ok: true };
  } catch (err) {
    return {
      syncId: budget.syncId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      await api.shutdown();
    } catch {
      // Best-effort cleanup — nothing more to do if shutdown itself fails.
    }
  }
}
