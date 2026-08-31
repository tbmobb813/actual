import * as api from '@actual-app/api';

import type { AppConfig } from '#config';
import {
  getPending,
  readStore,
  updateStatus,
  writeStore,
} from '#suggestion-store';
import type { Suggestion } from '#suggestion-store';

export type PromptFn = (question: string) => Promise<string>;

export type ReviewResult = {
  approved: number;
  rejected: number;
  skipped: number;
};

async function initApi(config: AppConfig): Promise<void> {
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
}

function describe(suggestion: Suggestion): string {
  return (
    `${suggestion.payeeName} -> ${suggestion.categoryName} ` +
    `(confidence ${suggestion.confidence.toFixed(2)}). Approve? [y/N/s] `
  );
}

/**
 * Walks every pending suggestion, asking the caller-provided prompt
 * function to approve, reject, or skip it. Approving creates a durable
 * "set category" rule for the payee (the same path the app's own
 * majority-vote learner uses) rather than silently editing transactions.
 */
export async function reviewSuggestions(
  config: AppConfig,
  prompt: PromptFn,
): Promise<ReviewResult> {
  const stored = readStore(config.storePath);
  const pending = getPending(stored);

  const result: ReviewResult = { approved: 0, rejected: 0, skipped: 0 };

  if (pending.length === 0) {
    return result;
  }

  await initApi(config);

  try {
    await api.downloadBudget(config.syncId, {
      password: config.budgetPassword,
    });

    let current = stored;

    for (const suggestion of pending) {
      const answer = (await prompt(describe(suggestion))).trim().toLowerCase();

      if (answer === 'y') {
        await api.createRule({
          stage: null,
          conditionsOp: 'and',
          conditions: [{ op: 'is', field: 'payee', value: suggestion.payeeId }],
          actions: [
            { op: 'set', field: 'category', value: suggestion.categoryId },
          ],
        });
        current = updateStatus(current, suggestion.payeeId, 'approved');
        result.approved++;
      } else if (answer === 'n') {
        current = updateStatus(current, suggestion.payeeId, 'rejected');
        result.rejected++;
      } else {
        result.skipped++;
      }
    }

    writeStore(config.storePath, current);

    return result;
  } finally {
    try {
      await api.shutdown();
    } catch {
      // Best-effort cleanup.
    }
  }
}
