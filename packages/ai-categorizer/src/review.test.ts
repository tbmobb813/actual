import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as api from '@actual-app/api';

import type { AppConfig } from './config';
import { reviewSuggestions } from './review';
import { readStore, writeStore } from './suggestion-store';
import type { Suggestion } from './suggestion-store';

vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  downloadBudget: vi.fn(),
  shutdown: vi.fn(),
  createRule: vi.fn(),
}));

let dir: string;
let storePath: string;

function baseConfig(): AppConfig {
  return {
    serverURL: 'https://sync.example.com',
    password: 'hunter2',
    syncId: 'budget-1',
    lookbackDays: 90,
    storePath,
    llm: { baseURL: 'https://api.example.com/v1', apiKey: 'k', model: 'm' },
  };
}

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    payeeId: 'payee-1',
    payeeName: 'Netflix',
    categoryId: 'cat-1',
    categoryName: 'Subscriptions',
    confidence: 0.9,
    sampleAmount: -1500,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(path.join(tmpdir(), 'ai-categorizer-review-test-'));
  storePath = path.join(dir, 'store.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('reviewSuggestions', () => {
  it('does nothing and never contacts the api when there is nothing pending', async () => {
    writeStore(storePath, [makeSuggestion({ status: 'approved' })]);

    const result = await reviewSuggestions(baseConfig(), vi.fn());

    expect(result).toEqual({ approved: 0, rejected: 0, skipped: 0 });
    expect(api.init).not.toHaveBeenCalled();
  });

  it('creates a rule and marks the suggestion approved on "y"', async () => {
    writeStore(storePath, [makeSuggestion()]);

    const result = await reviewSuggestions(baseConfig(), async () => 'y');

    expect(api.createRule).toHaveBeenCalledWith({
      stage: null,
      conditionsOp: 'and',
      conditions: [{ op: 'is', field: 'payee', value: 'payee-1' }],
      actions: [{ op: 'set', field: 'category', value: 'cat-1' }],
    });
    expect(result).toEqual({ approved: 1, rejected: 0, skipped: 0 });
    expect(readStore(storePath)[0].status).toBe('approved');
  });

  it('marks the suggestion rejected on "n" without creating a rule', async () => {
    writeStore(storePath, [makeSuggestion()]);

    const result = await reviewSuggestions(baseConfig(), async () => 'n');

    expect(api.createRule).not.toHaveBeenCalled();
    expect(result).toEqual({ approved: 0, rejected: 1, skipped: 0 });
    expect(readStore(storePath)[0].status).toBe('rejected');
  });

  it('leaves the suggestion pending on any other answer', async () => {
    writeStore(storePath, [makeSuggestion()]);

    const result = await reviewSuggestions(baseConfig(), async () => 's');

    expect(api.createRule).not.toHaveBeenCalled();
    expect(result).toEqual({ approved: 0, rejected: 0, skipped: 1 });
    expect(readStore(storePath)[0].status).toBe('pending');
  });

  it('walks multiple pending suggestions independently', async () => {
    writeStore(storePath, [
      makeSuggestion({ payeeId: 'payee-1' }),
      makeSuggestion({ payeeId: 'payee-2', payeeName: 'Shell' }),
    ]);

    const answers = ['y', 'n'];
    const result = await reviewSuggestions(baseConfig(), async () =>
      answers.shift(),
    );

    expect(result).toEqual({ approved: 1, rejected: 1, skipped: 0 });
    expect(api.createRule).toHaveBeenCalledTimes(1);
  });

  it('always shuts down the api, even if createRule throws', async () => {
    writeStore(storePath, [makeSuggestion()]);
    vi.mocked(api.createRule).mockRejectedValue(new Error('boom'));

    await expect(
      reviewSuggestions(baseConfig(), async () => 'y'),
    ).rejects.toThrow('boom');

    expect(api.shutdown).toHaveBeenCalled();
  });
});
