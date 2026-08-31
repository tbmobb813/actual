import { stdin, stdout } from 'node:process';
import readline from 'node:readline/promises';

import { loadConfig } from '#config';
import { createOpenAiCompatibleAdapter } from '#llm-adapter';
import { reviewSuggestions } from '#review';
import { generateSuggestions } from '#suggest';

async function main() {
  const command = process.argv[2];
  const config = loadConfig(process.env, { requireLlm: command === 'suggest' });

  if (command === 'suggest') {
    // requireLlm was true above, so loadConfig guarantees this is set.
    const adapter = createOpenAiCompatibleAdapter(config.llm!);
    const created = await generateSuggestions(config, adapter);
    console.log(
      `Generated ${created.length} new suggestion(s) in ${config.storePath}.`,
    );
    return;
  }

  if (command === 'review') {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      const result = await reviewSuggestions(config, q => rl.question(q));
      console.log(
        `Reviewed: ${result.approved} approved, ${result.rejected} rejected, ` +
          `${result.skipped} skipped.`,
      );
    } finally {
      rl.close();
    }
    return;
  }

  console.error('Usage: actual-ai-categorizer <suggest|review>');
  process.exitCode = 1;
}

void main();
