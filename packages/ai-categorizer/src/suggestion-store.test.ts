import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  getPending,
  mergeSuggestions,
  readStore,
  updateStatus,
  writeStore,
} from './suggestion-store';
import type { Suggestion } from './suggestion-store';

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

describe('mergeSuggestions', () => {
  it('adds a suggestion for a payee not seen before', () => {
    const merged = mergeSuggestions([], [makeSuggestion()]);
    expect(merged).toHaveLength(1);
  });

  it('does not re-add a payee that already has any suggestion', () => {
    const existing = [makeSuggestion({ status: 'rejected' })];
    const incoming = [makeSuggestion({ confidence: 0.99 })];

    const merged = mergeSuggestions(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('rejected');
    expect(merged[0].confidence).toBe(0.9);
  });

  it('keeps suggestions for different payees independent', () => {
    const merged = mergeSuggestions(
      [makeSuggestion({ payeeId: 'payee-1' })],
      [makeSuggestion({ payeeId: 'payee-2' })],
    );

    expect(merged.map(s => s.payeeId).sort()).toEqual(['payee-1', 'payee-2']);
  });
});

describe('getPending', () => {
  it('returns only pending suggestions', () => {
    const suggestions = [
      makeSuggestion({ payeeId: 'a', status: 'pending' }),
      makeSuggestion({ payeeId: 'b', status: 'approved' }),
      makeSuggestion({ payeeId: 'c', status: 'rejected' }),
    ];

    expect(getPending(suggestions).map(s => s.payeeId)).toEqual(['a']);
  });
});

describe('updateStatus', () => {
  it('updates only the matching payee', () => {
    const suggestions = [
      makeSuggestion({ payeeId: 'a' }),
      makeSuggestion({ payeeId: 'b' }),
    ];

    const updated = updateStatus(suggestions, 'a', 'approved');

    expect(updated.find(s => s.payeeId === 'a')?.status).toBe('approved');
    expect(updated.find(s => s.payeeId === 'b')?.status).toBe('pending');
  });
});

describe('readStore / writeStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'ai-categorizer-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty array when the file does not exist', () => {
    expect(readStore(path.join(dir, 'missing.json'))).toEqual([]);
  });

  it('round-trips suggestions through disk', () => {
    const file = path.join(dir, 'store.json');
    const suggestions = [makeSuggestion()];

    writeStore(file, suggestions);

    expect(readStore(file)).toEqual(suggestions);
  });

  it('does not leave a temp file behind after a successful write', () => {
    const file = path.join(dir, 'store.json');

    writeStore(file, [makeSuggestion()]);

    const entries = readdirSync(dir);
    expect(entries).toEqual(['store.json']);
  });

  it('quarantines a corrupt file instead of throwing, and returns an empty array', () => {
    const file = path.join(dir, 'store.json');
    writeFileSync(file, '{not valid json');

    const result = readStore(file);

    expect(result).toEqual([]);
    expect(existsSync(file)).toBe(false);
    const entries = readdirSync(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^store\.json\.corrupt-\d+$/);
  });
});
