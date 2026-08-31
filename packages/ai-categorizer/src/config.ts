export type AppConfig = {
  serverURL: string;
  password?: string;
  sessionToken?: string;
  dataDir?: string;
  syncId: string;
  budgetPassword?: string;
  /** How far back to look for uncategorized transactions, in days. */
  lookbackDays: number;
  /** Where pending/reviewed suggestions are persisted between runs. */
  storePath: string;
  llm: LlmConfig;
};

export type LlmConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export class ConfigError extends Error {}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const serverURL = env.ACTUAL_SERVER_URL;
  if (!serverURL) {
    throw new ConfigError('ACTUAL_SERVER_URL is required');
  }

  const password = env.ACTUAL_PASSWORD;
  const sessionToken = env.ACTUAL_SESSION_TOKEN;
  if (!password && !sessionToken) {
    throw new ConfigError(
      'Either ACTUAL_PASSWORD or ACTUAL_SESSION_TOKEN is required',
    );
  }

  const syncId = env.ACTUAL_SYNC_ID;
  if (!syncId) {
    throw new ConfigError('ACTUAL_SYNC_ID is required (the budget to review)');
  }

  const lookbackDays = env.ACTUAL_LOOKBACK_DAYS
    ? Number(env.ACTUAL_LOOKBACK_DAYS)
    : 90;
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    throw new ConfigError('ACTUAL_LOOKBACK_DAYS must be a positive number');
  }

  const aiBaseURL = env.AI_BASE_URL;
  const aiApiKey = env.AI_API_KEY;
  const aiModel = env.AI_MODEL;
  if (!aiBaseURL || !aiApiKey || !aiModel) {
    throw new ConfigError(
      'AI_BASE_URL, AI_API_KEY, and AI_MODEL are all required',
    );
  }

  return {
    serverURL,
    password,
    sessionToken,
    dataDir: env.ACTUAL_DATA_DIR,
    syncId,
    budgetPassword: env.ACTUAL_BUDGET_PASSWORD,
    lookbackDays,
    storePath: env.AI_CATEGORIZER_STORE_PATH || './ai-categorizer-store.json',
    llm: {
      baseURL: aiBaseURL,
      apiKey: aiApiKey,
      model: aiModel,
    },
  };
}
