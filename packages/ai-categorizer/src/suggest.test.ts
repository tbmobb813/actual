import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as api from '@actual-app/api';

import type { AppConfig } from './config';
import type { LlmAdapter } from './llm-adapter';
import { generateSuggestions } from './suggest';
import { readStore, writeStore } from './suggestion-store';

vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  downloadBudget: vi.fn(),
  shutdown: vi.fn(),
  getAccounts: vi.fn(),
  getCategories: vi.fn(),
  getPayees: vi.fn(),
  getTransactions: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(path.join(tmpdir(), 'ai-categorizer-suggest-test-'));
  storePath = path.join(dir, 'store.json');

  vi.mocked(api.getAccounts).mockResolvedValue([
    { id: 'acct-1', name: 'Checking', closed: false },
  ] as never);
  vi.mocked(api.getCategories).mockResolvedValue([
    { id: 'cat-1', name: 'Subscriptions', hidden: false },
  ] as never);
  vi.mocked(api.getPayees).mockResolvedValue([
    { id: 'payee-1', name: 'Netflix' },
  ] as never);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('generateSuggestions', () => {
  it('only considers uncategorized, non-transfer transactions with a payee', async () => {
    vi.mocked(api.getTransactions).mockResolvedValue([
      { id: 't1', category: 'cat-1', payee: 'payee-1', amount: -100 },
      { id: 't2', category: null, payee: null, amount: -200 },
      {
        id: 't3',
        category: null,
        payee: 'payee-1',
        amount: -300,
        transfer_id: 'x',
      },
      { id: 't4', category: null, payee: 'payee-1', amount: -1500 },
    ] as never);

    const adapter: LlmAdapter = vi
      .fn()
      .mockResolvedValue([
        { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.9 },
      ]);

    await generateSuggestions(baseConfig(), adapter);

    expect(adapter).toHaveBeenCalledWith(
      [
        {
          payeeId: 'payee-1',
          payeeName: 'Netflix',
          sampleAmount: -1500,
          sampleNotes: undefined,
        },
      ],
      [{ id: 'cat-1', name: 'Subscriptions' }],
    );
  });

  it('writes new suggestions to the store', async () => {
    vi.mocked(api.getTransactions).mockResolvedValue([
      { id: 't1', category: null, payee: 'payee-1', amount: -1500 },
    ] as never);

    const adapter: LlmAdapter = vi
      .fn()
      .mockResolvedValue([
        { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.9 },
      ]);

    const created = await generateSuggestions(baseConfig(), adapter);

    expect(created).toEqual([
      {
        payeeId: 'payee-1',
        payeeName: 'Netflix',
        categoryId: 'cat-1',
        categoryName: 'Subscriptions',
        confidence: 0.9,
        sampleAmount: -1500,
        status: 'pending',
        createdAt: expect.any(String),
      },
    ]);
    expect(readStore(storePath)).toEqual(created);
  });

  it('does not re-suggest a payee already present in the store', async () => {
    writeStore(storePath, [
      {
        payeeId: 'payee-1',
        payeeName: 'Netflix',
        categoryId: 'cat-1',
        categoryName: 'Subscriptions',
        confidence: 0.5,
        sampleAmount: -1500,
        status: 'rejected',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    vi.mocked(api.getTransactions).mockResolvedValue([
      { id: 't1', category: null, payee: 'payee-1', amount: -1500 },
    ] as never);

    const adapter: LlmAdapter = vi.fn();

    const created = await generateSuggestions(baseConfig(), adapter);

    expect(adapter).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it('skips closed accounts', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue([
      { id: 'acct-1', name: 'Old', closed: true },
    ] as never);

    const adapter: LlmAdapter = vi.fn().mockResolvedValue([]);

    await generateSuggestions(baseConfig(), adapter);

    expect(api.getTransactions).not.toHaveBeenCalled();
  });

  it('always shuts down the api, even if something throws', async () => {
    vi.mocked(api.getAccounts).mockRejectedValue(new Error('boom'));

    await expect(generateSuggestions(baseConfig(), vi.fn())).rejects.toThrow(
      'boom',
    );

    expect(api.shutdown).toHaveBeenCalled();
  });
});
