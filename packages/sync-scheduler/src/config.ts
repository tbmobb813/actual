export type BudgetConfig = {
  syncId: string;
  /** Per-file encryption password, only needed if the budget is end-to-end encrypted. */
  password?: string;
};

export type SchedulerConfig = {
  serverURL: string;
  password?: string;
  sessionToken?: string;
  dataDir?: string;
  intervalMinutes: number;
  budgets: BudgetConfig[];
};

export class ConfigError extends Error {}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

// Unlike splitList, preserves empty positions (e.g. "pw1,,pw3") so each
// entry lines up positionally with ACTUAL_SYNC_IDS.
function splitPositionalList(value: string | undefined): string[] {
  if (value == null || value === '') return [];
  return value.split(',').map(part => part.trim());
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): SchedulerConfig {
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

  const syncIds = splitList(env.ACTUAL_SYNC_IDS);
  if (syncIds.length === 0) {
    throw new ConfigError(
      'ACTUAL_SYNC_IDS is required (comma-separated budget sync ids)',
    );
  }

  const budgetPasswords = splitPositionalList(env.ACTUAL_BUDGET_PASSWORDS);
  if (budgetPasswords.length > 0 && budgetPasswords.length !== syncIds.length) {
    throw new ConfigError(
      'ACTUAL_BUDGET_PASSWORDS must either be empty or have exactly as ' +
        'many comma-separated entries as ACTUAL_SYNC_IDS (use an empty ' +
        'entry, e.g. "pw1,,pw3", for budgets with no file password)',
    );
  }

  const budgets: BudgetConfig[] = syncIds.map((syncId, i) => ({
    syncId,
    password: budgetPasswords[i] || undefined,
  }));

  const intervalMinutes = env.ACTUAL_SYNC_INTERVAL_MINUTES
    ? Number(env.ACTUAL_SYNC_INTERVAL_MINUTES)
    : 20;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new ConfigError(
      'ACTUAL_SYNC_INTERVAL_MINUTES must be a positive number',
    );
  }

  return {
    serverURL,
    password,
    sessionToken,
    dataDir: env.ACTUAL_DATA_DIR,
    intervalMinutes,
    budgets,
  };
}
