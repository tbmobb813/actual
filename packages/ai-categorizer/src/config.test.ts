import { ConfigError, loadConfig } from './config';

const BASE_ENV = {
  ACTUAL_SERVER_URL: 'https://sync.example.com',
  ACTUAL_PASSWORD: 'hunter2',
  ACTUAL_SYNC_ID: 'budget-1',
  AI_BASE_URL: 'https://api.openai.com/v1',
  AI_API_KEY: 'sk-test',
  AI_MODEL: 'gpt-test',
};

describe('loadConfig', () => {
  it('loads a minimal valid config with defaults', () => {
    const config = loadConfig(BASE_ENV);

    expect(config).toEqual({
      serverURL: 'https://sync.example.com',
      password: 'hunter2',
      sessionToken: undefined,
      dataDir: undefined,
      syncId: 'budget-1',
      budgetPassword: undefined,
      lookbackDays: 90,
      storePath: './ai-categorizer-store.json',
      llm: {
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-test',
      },
    });
  });

  it('respects custom lookback and store path', () => {
    const config = loadConfig({
      ...BASE_ENV,
      ACTUAL_LOOKBACK_DAYS: '30',
      AI_CATEGORIZER_STORE_PATH: '/data/store.json',
    });

    expect(config.lookbackDays).toBe(30);
    expect(config.storePath).toBe('/data/store.json');
  });

  it('accepts a session token instead of a password', () => {
    const config = loadConfig({
      ...BASE_ENV,
      ACTUAL_PASSWORD: undefined,
      ACTUAL_SESSION_TOKEN: 'session-abc',
    });

    expect(config.sessionToken).toBe('session-abc');
    expect(config.password).toBeUndefined();
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

  it('throws when ACTUAL_SYNC_ID is missing', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_SYNC_ID: undefined }),
    ).toThrow(ConfigError);
  });

  it('throws for a non-positive lookback', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ACTUAL_LOOKBACK_DAYS: '0' }),
    ).toThrow(ConfigError);
  });

  it('throws when any AI_* variable is missing', () => {
    expect(() => loadConfig({ ...BASE_ENV, AI_BASE_URL: undefined })).toThrow(
      ConfigError,
    );
    expect(() => loadConfig({ ...BASE_ENV, AI_API_KEY: undefined })).toThrow(
      ConfigError,
    );
    expect(() => loadConfig({ ...BASE_ENV, AI_MODEL: undefined })).toThrow(
      ConfigError,
    );
  });

  describe('requireLlm: false', () => {
    const envWithoutLlm = {
      ACTUAL_SERVER_URL: 'https://sync.example.com',
      ACTUAL_PASSWORD: 'hunter2',
      ACTUAL_SYNC_ID: 'budget-1',
    };

    it('does not require AI_* variables', () => {
      const config = loadConfig(envWithoutLlm, { requireLlm: false });

      expect(config.llm).toBeUndefined();
    });

    it('still validates AI_* variables together if any are partially set', () => {
      expect(() =>
        loadConfig(
          { ...envWithoutLlm, AI_BASE_URL: 'https://api.example.com' },
          { requireLlm: false },
        ),
      ).toThrow(ConfigError);
    });

    it('still populates llm when the AI_* variables are present', () => {
      const config = loadConfig(BASE_ENV, { requireLlm: false });

      expect(config.llm).toEqual({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-test',
      });
    });
  });
});
