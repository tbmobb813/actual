import { createOpenAiCompatibleAdapter, parseSuggestions } from './llm-adapter';
import type { CategoryOption, PayeeExample } from './llm-adapter';

const payees: PayeeExample[] = [
  { payeeId: 'payee-1', payeeName: 'Netflix', sampleAmount: -1500 },
  { payeeId: 'payee-2', payeeName: 'Shell Gas', sampleAmount: -4000 },
];

const categories: CategoryOption[] = [
  { id: 'cat-1', name: 'Subscriptions' },
  { id: 'cat-2', name: 'Fuel' },
];

describe('parseSuggestions', () => {
  it('parses a plain JSON array response', () => {
    const content = JSON.stringify([
      { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.95 },
    ]);

    expect(parseSuggestions(content, payees, categories)).toEqual([
      { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.95 },
    ]);
  });

  it('strips a markdown code fence around the JSON', () => {
    const content =
      '```json\n' +
      JSON.stringify([
        { payeeId: 'payee-2', categoryId: 'cat-2', confidence: 0.8 },
      ]) +
      '\n```';

    expect(parseSuggestions(content, payees, categories)).toEqual([
      { payeeId: 'payee-2', categoryId: 'cat-2', confidence: 0.8 },
    ]);
  });

  it('drops suggestions that reference an unknown payeeId', () => {
    const content = JSON.stringify([
      { payeeId: 'payee-999', categoryId: 'cat-1', confidence: 0.9 },
    ]);

    expect(parseSuggestions(content, payees, categories)).toEqual([]);
  });

  it('drops suggestions that reference an unknown categoryId', () => {
    const content = JSON.stringify([
      { payeeId: 'payee-1', categoryId: 'cat-999', confidence: 0.9 },
    ]);

    expect(parseSuggestions(content, payees, categories)).toEqual([]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    const content = JSON.stringify([
      { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.9 },
      { payeeId: 'payee-2' }, // missing categoryId/confidence
      'not an object',
    ]);

    expect(parseSuggestions(content, payees, categories)).toEqual([
      { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.9 },
    ]);
  });

  it('throws when the response is not valid JSON', () => {
    expect(() =>
      parseSuggestions('not json at all', payees, categories),
    ).toThrow(/Failed to parse/);
  });

  it('throws when the response is valid JSON but not an array', () => {
    expect(() =>
      parseSuggestions('{"foo": "bar"}', payees, categories),
    ).toThrow(/must be an array/);
  });
});

describe('createOpenAiCompatibleAdapter', () => {
  const config = {
    baseURL: 'https://api.example.com/v1',
    apiKey: 'sk-test',
    model: 'test-model',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns an empty array without calling the API when there are no payees', async () => {
    const adapter = createOpenAiCompatibleAdapter(config);

    const result = await adapter([], categories);

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends a chat-completions request and parses the response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify([
                { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.9 },
              ]),
            },
          },
        ],
      }),
    } as Response);

    const adapter = createOpenAiCompatibleAdapter(config);
    const result = await adapter(payees, categories);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      }),
    );
    expect(result).toEqual([
      { payeeId: 'payee-1', categoryId: 'cat-1', confidence: 0.9 },
    ]);
  });

  it('throws when the HTTP request fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    } as Response);

    const adapter = createOpenAiCompatibleAdapter(config);

    await expect(adapter(payees, categories)).rejects.toThrow(
      /LLM request failed: 500/,
    );
  });

  it('throws when the response has no message content', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: {} }] }),
    } as Response);

    const adapter = createOpenAiCompatibleAdapter(config);

    await expect(adapter(payees, categories)).rejects.toThrow(
      /did not include message content/,
    );
  });
});
