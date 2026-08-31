import type { LlmConfig } from '#config';

export type PayeeExample = {
  payeeId: string;
  payeeName: string;
  sampleAmount: number;
  sampleNotes?: string;
};

export type CategoryOption = {
  id: string;
  name: string;
};

export type CategorySuggestion = {
  payeeId: string;
  categoryId: string;
  confidence: number;
};

export type LlmAdapter = (
  payees: PayeeExample[],
  categories: CategoryOption[],
) => Promise<CategorySuggestion[]>;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const SYSTEM_PROMPT =
  'You categorize personal-finance transactions. Given a list of payees ' +
  'and a list of allowed categories, respond with ONLY a JSON array (no ' +
  'prose, no markdown) of {"payeeId": string, "categoryId": string, ' +
  '"confidence": number} objects, one per payee you are confident about. ' +
  'Omit any payee you are not reasonably confident about. Use only the ' +
  'payeeId and categoryId values given to you — never invent new ones. ' +
  'confidence is a number between 0 and 1.';

/**
 * Creates an LLM adapter against any OpenAI-chat-completions-compatible
 * endpoint (OpenAI itself, many self-hosted/local model servers, and
 * most LLM gateways). The base URL is configurable rather than hardcoding
 * a single provider.
 */
export function createOpenAiCompatibleAdapter(config: LlmConfig): LlmAdapter {
  return async function suggestCategories(payees, categories) {
    if (payees.length === 0) {
      return [];
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(payees, categories) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `LLM request failed: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('LLM response did not include message content');
    }

    return parseSuggestions(content, payees, categories);
  };
}

function buildPrompt(
  payees: PayeeExample[],
  categories: CategoryOption[],
): string {
  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
  const payeeList = payees
    .map(
      p =>
        `${p.payeeId}: "${p.payeeName}"` +
        (p.sampleNotes ? ` (notes: ${p.sampleNotes})` : ''),
    )
    .join('\n');

  return (
    `Categories:\n${categoryList}\n\n` + `Payees to categorize:\n${payeeList}`
  );
}

/**
 * Parses the model's JSON response and drops anything that doesn't
 * reference a payeeId/categoryId we actually sent — models occasionally
 * invent or slightly alter ids, and a hallucinated id must never reach
 * createRule.
 */
export function parseSuggestions(
  content: string,
  payees: PayeeExample[],
  categories: CategoryOption[],
): CategorySuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${(err as Error).message}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response JSON must be an array');
  }

  const payeeIds = new Set(payees.map(p => p.payeeId));
  const categoryIds = new Set(categories.map(c => c.id));

  return parsed.filter(
    (item): item is CategorySuggestion =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as CategorySuggestion).payeeId === 'string' &&
      payeeIds.has((item as CategorySuggestion).payeeId) &&
      typeof (item as CategorySuggestion).categoryId === 'string' &&
      categoryIds.has((item as CategorySuggestion).categoryId) &&
      typeof (item as CategorySuggestion).confidence === 'number',
  );
}

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1] : content;
}
