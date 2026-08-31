import * as api from '@actual-app/api';

import type { SchedulerConfig } from './config';
import { runSyncOnce } from './run-sync';

vi.mock('@actual-app/api', () => ({
  init: vi.fn(),
  downloadBudget: vi.fn(),
  runBankSync: vi.fn(),
  shutdown: vi.fn(),
}));

const baseConfig: SchedulerConfig = {
  serverURL: 'https://sync.example.com',
  password: 'hunter2',
  intervalMinutes: 20,
  budgets: [{ syncId: 'budget-1' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runSyncOnce', () => {
  it('inits with the server password, downloads, and syncs each budget', async () => {
    const results = await runSyncOnce(baseConfig);

    expect(api.init).toHaveBeenCalledWith({
      serverURL: 'https://sync.example.com',
      password: 'hunter2',
      dataDir: undefined,
    });
    expect(api.downloadBudget).toHaveBeenCalledWith('budget-1', {
      password: undefined,
    });
    expect(api.runBankSync).toHaveBeenCalled();
    expect(api.shutdown).toHaveBeenCalled();
    expect(results).toEqual([{ syncId: 'budget-1', ok: true }]);
  });

  it('uses a session token instead of a password when provided', async () => {
    await runSyncOnce({
      ...baseConfig,
      password: undefined,
      sessionToken: 'session-abc',
    });

    expect(api.init).toHaveBeenCalledWith({
      serverURL: 'https://sync.example.com',
      sessionToken: 'session-abc',
      dataDir: undefined,
    });
  });

  it('syncs every configured budget independently', async () => {
    const results = await runSyncOnce({
      ...baseConfig,
      budgets: [
        { syncId: 'budget-1' },
        { syncId: 'budget-2', password: 'file-pw' },
      ],
    });

    expect(api.downloadBudget).toHaveBeenNthCalledWith(1, 'budget-1', {
      password: undefined,
    });
    expect(api.downloadBudget).toHaveBeenNthCalledWith(2, 'budget-2', {
      password: 'file-pw',
    });
    expect(results).toEqual([
      { syncId: 'budget-1', ok: true },
      { syncId: 'budget-2', ok: true },
    ]);
  });

  it('reports a failed sync without throwing, and still shuts down', async () => {
    vi.mocked(api.runBankSync).mockRejectedValueOnce(
      new Error('rate-limit-exceeded'),
    );

    const results = await runSyncOnce(baseConfig);

    expect(results).toEqual([
      { syncId: 'budget-1', ok: false, error: 'rate-limit-exceeded' },
    ]);
    expect(api.shutdown).toHaveBeenCalled();
  });

  it('continues syncing remaining budgets after one fails', async () => {
    vi.mocked(api.downloadBudget).mockRejectedValueOnce(
      new Error('file-not-found'),
    );

    const results = await runSyncOnce({
      ...baseConfig,
      budgets: [{ syncId: 'budget-1' }, { syncId: 'budget-2' }],
    });

    expect(results).toEqual([
      { syncId: 'budget-1', ok: false, error: 'file-not-found' },
      { syncId: 'budget-2', ok: true },
    ]);
  });

  it('does not fail the whole run if shutdown itself throws', async () => {
    vi.mocked(api.shutdown).mockRejectedValueOnce(new Error('already closed'));

    const results = await runSyncOnce(baseConfig);

    expect(results).toEqual([{ syncId: 'budget-1', ok: true }]);
  });
});
