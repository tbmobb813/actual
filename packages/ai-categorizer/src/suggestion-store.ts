import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export type Suggestion = {
  payeeId: string;
  payeeName: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
  /** One example amount (in cents) from the transactions that prompted this suggestion. */
  sampleAmount: number;
  status: SuggestionStatus;
  createdAt: string;
};

/**
 * Merges newly generated suggestions into the existing store.
 * A payee that already has any suggestion (pending, approved, or
 * rejected) is left untouched — the user has already seen or decided
 * on it, so we don't want to keep re-suggesting the same payee run
 * after run.
 */
export function mergeSuggestions(
  existing: Suggestion[],
  incoming: Suggestion[],
): Suggestion[] {
  const knownPayeeIds = new Set(existing.map(s => s.payeeId));
  const additions = incoming.filter(s => !knownPayeeIds.has(s.payeeId));
  return [...existing, ...additions];
}

export function getPending(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter(s => s.status === 'pending');
}

export function updateStatus(
  suggestions: Suggestion[],
  payeeId: string,
  status: SuggestionStatus,
): Suggestion[] {
  return suggestions.map(s => (s.payeeId === payeeId ? { ...s, status } : s));
}

export function readStore(path: string): Suggestion[] {
  if (!existsSync(path)) {
    return [];
  }
  const contents = readFileSync(path, 'utf-8');
  if (contents.trim() === '') {
    return [];
  }

  try {
    return JSON.parse(contents) as Suggestion[];
  } catch (err) {
    // A truncated/corrupt file (e.g. the process was killed mid-write)
    // must not crash the CLI or silently discard suggestion history.
    // Move it aside for manual recovery and start fresh.
    const quarantinePath = `${path}.corrupt-${Date.now()}`;
    renameSync(path, quarantinePath);
    console.error(
      `Suggestion store at ${path} was corrupt (${(err as Error).message}); ` +
        `moved it to ${quarantinePath} and starting with an empty store.`,
    );
    return [];
  }
}

export function writeStore(path: string, suggestions: Suggestion[]): void {
  // Write to a temp file and rename over the target so a crash mid-write
  // can never leave a truncated/corrupt store file — rename is atomic on
  // the same filesystem.
  const tmpPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tmpPath, JSON.stringify(suggestions, null, 2));
  renameSync(tmpPath, path);
}
