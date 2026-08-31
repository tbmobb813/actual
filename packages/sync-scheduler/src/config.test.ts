import { ConfigError, loadConfig } from './config';

const BASE_ENV = {
  ACTUAL_SERVER_URL: 'https://sync.example.com',
  ACTUAL_PASSWORD: 'hunter2',
  ACTUAL_SYNC_IDS: 'budget-1',
};

describe('loadConfig', () => {
  it('loads a minimal valid config with defaults', () => {
    const config = loadConfig(BASE_ENV);

    expect(config).toEqual({
      serverURL: 'https://sync.example.com',
      password: 'hunter2',
      sessionToken: undefined,
      dataDir: undefined,
      intervalMinutes: 20,
      budgets: [{ syncId: 'budget-1', password: undefined }],
    });
  });

  it('parses multiple sync ids and matching budget passwords', () => {
    const config = loadConfig({
      ...BASE_ENV,
      ACTUAL_SYNC_IDS: 'budget-1,budget-2,budget-3',
      ACTUAL_BUDGET_PASSWORDS: 'pw1,,pw3',
    });

    expect(config.budgets).toEqual([
      { syncId: 'budget-1', password: 'pw1' },
      { syncId: 'budget-2', password: undefined },
      { syncId: 'budget-3', password: 'pw3' },
    ]);
  });

  it('accepts a session token instead of a password', () => {
    const config = loadConfig({
      ACTUAL_SERVER_URL: 'https://sync.example.com',
      ACTUAL_SESSION_TOKEN: 'session-abc',
      ACTUAL_SYNC_IDS: 'budget-1',
    });

    expect(config.sessionToken).toBe('session-abc');
    expect(config.password).toBeUndefined();
  });

  it('respects a custom interval', () => {
    const config = loadConfig({
      ...BASE_ENV,
      ACTUAL_SYNC_INTERVAL_MINUTES: '45',
    });

    expect(config.intervalMinutes).toBe(45);
  });

  it('throws when ACTUAL_SERVER_URL is missing', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_SERVER_URL: undefined }),
    ).toThrow(ConfigError);
  });

  it('throws when neither password nor session token is given', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_PASSWORD: undefined }),
    ).toThrow(ConfigError);
  });

  it('throws when ACTUAL_SYNC_IDS is missing', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_SYNC_IDS: undefined }),
    ).toThrow(ConfigError);
  });

  it('throws when budget password count does not match sync id count', () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        ACTUAL_SYNC_IDS: 'budget-1,budget-2',
        ACTUAL_BUDGET_PASSWORDS: 'pw1',
      }),
    ).toThrow(ConfigError);
  });

  it('throws for a non-positive interval', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_SYNC_INTERVAL_MINUTES: '0' }),
    ).toThrow(ConfigError);
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_SYNC_INTERVAL_MINUTES: 'not-a-number' }),
    ).toThrow(ConfigError);
  });
});
