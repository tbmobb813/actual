import * as api from '@actual-app/api';

import type { AppConfig } from '#config';
import type { CategoryOption, LlmAdapter, PayeeExample } from '#llm-adapter';
import type { Suggestion } from '#suggestion-store';
import { mergeSuggestions, readStore, writeStore } from '#suggestion-store';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

export async function generateSuggestions(
  config: AppConfig,
  llmAdapter: LlmAdapter,
): Promise<Suggestion[]> {
  await initApi(config);

  try {
    await api.downloadBudget(config.syncId, {
      password: config.budgetPassword,
    });

    const [accounts, rawCategories, rawPayees] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getPayees(),
    ]);

    const categories: CategoryOption[] = rawCategories
      .filter(c => !c.hidden)
      .map(c => ({ id: c.id, name: c.name }));
    const payeeNames = new Map(rawPayees.map(p => [p.id, p.name]));

    const endDate = formatDate(new Date());
    const startDate = formatDate(
      new Date(Date.now() - config.lookbackDays * MS_PER_DAY),
    );

    const sampleByPayee = new Map<
      string,
      { sampleAmount: number; sampleNotes?: string }
    >();

    for (const account of accounts.filter(a => !a.closed)) {
      const transactions = await api.getTransactions(
        account.id,
        startDate,
        endDate,
      );

      for (const t of transactions) {
        if (t.category || !t.payee || t.transfer_id) continue;
        if (!sampleByPayee.has(t.payee)) {
          sampleByPayee.set(t.payee, {
            sampleAmount: t.amount,
            sampleNotes: t.notes,
          });
        }
      }
    }

    const existing = readStore(config.storePath);
    const alreadyKnown = new Set(existing.map(s => s.payeeId));

    const payeeExamples: PayeeExample[] = [...sampleByPayee.entries()]
      .filter(([payeeId]) => !alreadyKnown.has(payeeId))
      .map(([payeeId, sample]) => ({
        payeeId,
        payeeName: payeeNames.get(payeeId) ?? payeeId,
        sampleAmount: sample.sampleAmount,
        sampleNotes: sample.sampleNotes,
      }));

    const rawSuggestions =
      payeeExamples.length > 0
        ? await llmAdapter(payeeExamples, categories)
        : [];

    const categoryNames = new Map(categories.map(c => [c.id, c.name]));
    const exampleByPayee = new Map(payeeExamples.map(p => [p.payeeId, p]));

    const newSuggestions: Suggestion[] = rawSuggestions.map(s => ({
      payeeId: s.payeeId,
      payeeName: exampleByPayee.get(s.payeeId)?.payeeName ?? s.payeeId,
      categoryId: s.categoryId,
      categoryName: categoryNames.get(s.categoryId) ?? s.categoryId,
      confidence: s.confidence,
      sampleAmount: exampleByPayee.get(s.payeeId)?.sampleAmount ?? 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));

    writeStore(config.storePath, mergeSuggestions(existing, newSuggestions));

    return newSuggestions;
  } finally {
    try {
      await api.shutdown();
    } catch {
      // Best-effort cleanup.
    }
  }
}
