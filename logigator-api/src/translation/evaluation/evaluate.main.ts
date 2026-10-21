/* Entry point of the `translation-evaluate.js` bundle: runs the translator over
   the examples' originals and a set of constructed cases, once per candidate
   model, and writes a report comparing them with the human versions.

   A candidate is sent as `<candidate>@preset/<OPENROUTER_PRESET>`, which keeps
   the preset's routing, token cap and reasoning effort and swaps only the
   model; with no candidate the preset's own model runs. Needs only
   OPENROUTER_API_KEY and OPENROUTER_PRESET — no database, no Redis.

   `--probe-limit` instead asks `GET /api/v1/key` about the key and makes one
   tiny translation call, printing both answers raw: run against a key whose
   limit is spent, it shows whether the key endpoint answers an inference key
   and which status a spent limit returns.

   eslint-disable no-console: a CLI whose only output channel is the terminal.

   Usage:
     node translation-evaluate.js --out <dir> [--model <candidate>]... [--concurrency 4]
     node translation-evaluate.js --probe-limit
*/
/* eslint-disable no-console */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from '../../config/env';
import {
  defaultExamplesFolder,
  loadExampleSet
} from '../../documents/example-set';
import {
  buildCompletionRequest,
  OPENROUTER_BASE_URL,
  OpenRouterClient,
  openRouterHeaders
} from '../openrouter/openrouter.client';
import { CONSTRUCTED_CASES, exampleCases } from './evaluation-cases';
import {
  type CaseResult,
  type EvaluationReport,
  type ModelReport,
  renderMarkdown,
  scoreCase,
  summarizeZdr,
  totalsOf,
  type ZdrEndpoint
} from './evaluation-report';

const PRESET_SUFFIX = '@preset/';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      model: { type: 'string', multiple: true },
      concurrency: { type: 'string', default: '4' },
      'probe-limit': { type: 'boolean', default: false }
    }
  });

  const env = loadEnv(process.env);
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_PRESET) {
    throw new Error('Set OPENROUTER_API_KEY and OPENROUTER_PRESET.');
  }
  const options = {
    apiKey: env.OPENROUTER_API_KEY,
    preset: env.OPENROUTER_PRESET,
    publicUrl: env.PUBLIC_URL
  };

  if (values['probe-limit']) {
    await probeLimit(options);
    return;
  }

  if (!values.out) {
    throw new Error('Name the report folder with --out <dir>.');
  }
  // Yarn runs a script from the package folder; a relative path means the
  // folder it was typed in.
  const out = resolve(process.env['INIT_CWD'] ?? process.cwd(), values.out);
  const concurrency = Math.max(1, Number(values.concurrency) || 1);

  const cases = [
    ...exampleCases(await loadExampleSet(defaultExamplesFolder())),
    ...CONSTRUCTED_CASES
  ];
  const zdrList = await fetchZdrList();
  const candidates: (string | null)[] = values.model?.length
    ? values.model
    : [null];

  const models: ModelReport[] = [];
  for (const candidate of candidates) {
    const model = `${candidate ?? ''}${PRESET_SUFFIX}${options.preset}`;
    console.log(`Running ${cases.length} cases on ${model}…`);

    const client = new OpenRouterClient({
      ...options,
      model,
      // Per-call usage is in the report; the terminal shows progress only.
      logger: { log: () => undefined, warn: () => undefined }
    });
    const results = await mapPooled(cases, concurrency, async (entry) => {
      const started = Date.now();
      const outcome = await client.translate(entry.input, entry.id);
      const result = scoreCase(entry, outcome, Date.now() - started);
      console.log(`  ${entry.id}: ${describe(result)}`);
      return result;
    });

    const ids = new Set([
      ...(candidate ? [candidate] : []),
      ...results.flatMap((result) => result.servedModels)
    ]);
    models.push({
      model,
      candidate,
      zdr: Object.fromEntries(
        [...ids].map((id) => [id, summarizeZdr(zdrList, id)])
      ),
      totals: totalsOf(results),
      cases: results
    });
  }

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    preset: options.preset,
    cases,
    models
  };
  await mkdir(out, { recursive: true });
  await writeFile(
    join(out, 'translation-evaluation.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    join(out, 'translation-evaluation.md'),
    renderMarkdown(report)
  );

  console.table(
    Object.fromEntries(models.map((model) => [model.model, model.totals]))
  );
  console.log(`Wrote translation-evaluation.json and .md to ${out}.`);
}

function describe(result: CaseResult): string {
  if (!result.translation) {
    return `${result.failure?.kind}: ${result.failure?.reason}`;
  }
  const flags = [
    ...result.overTranslated.map((entry) => `over ${entry}`),
    ...result.underTranslated.map((entry) => `under ${entry}`)
  ];
  return (
    `${result.translation.nameLanguage}/${result.translation.descriptionLanguage}, ` +
    `$${result.costUsd.toFixed(5)}${flags.length ? `, ${flags.join(', ')}` : ''}`
  );
}

/** OpenRouter's public list of zero-data-retention endpoints. */
async function fetchZdrList(): Promise<ZdrEndpoint[]> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/api/v1/endpoints/zdr`, {
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    throw new Error(`The zero-retention list answered ${response.status}.`);
  }
  return ((await response.json()) as { data: ZdrEndpoint[] }).data;
}

/** Prints what the key endpoint and one call say about this key, raw. */
async function probeLimit(options: {
  apiKey: string;
  preset: string;
  publicUrl: string;
}): Promise<void> {
  const headers = openRouterHeaders(options.apiKey, options.publicUrl);

  const key = await fetch(`${OPENROUTER_BASE_URL}/api/v1/key`, {
    headers,
    signal: AbortSignal.timeout(30_000)
  });
  console.log(`GET /api/v1/key → ${key.status}`);
  console.log(await key.text());
  console.log('Classified:', await new OpenRouterClient(options).readBudget());

  const call = await fetch(`${OPENROUTER_BASE_URL}/api/v1/chat/completions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(
      buildCompletionRequest(`${PRESET_SUFFIX}${options.preset}`, {
        name: 'Probe',
        description: '',
        hint: 'en'
      })
    ),
    signal: AbortSignal.timeout(60_000)
  });
  console.log(`POST /api/v1/chat/completions → ${call.status}`);
  console.log(`Retry-After: ${call.headers.get('retry-after') ?? '(none)'}`);
  console.log(await call.text());
}

/** `Promise.all` over `items` with at most `limit` running at once, in order. */
async function mapPooled<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
