import { type Locale, LOCALES } from '../../common/locale';
import type {
  DocumentTranslation,
  ReplyRejection,
  TranslationOutcome
} from '../translator';
import type { EvaluationCase, Field } from './evaluation-cases';

/** One endpoint of OpenRouter's public zero-data-retention list. */
export interface ZdrEndpoint {
  name: string;
  model_id: string;
  provider_name: string;
  supported_parameters?: string[];
}

export interface ZdrSummary {
  endpoints: number;
  withStructuredOutputs: number;
  providers: string[];
}

/** A model's zero-retention endpoints, matched by id or by the endpoint's dated slug. */
export function summarizeZdr(list: ZdrEndpoint[], modelId: string): ZdrSummary {
  const matching = list.filter(
    (endpoint) =>
      endpoint.model_id === modelId ||
      endpoint.name.split(' | ').at(-1) === modelId
  );
  return {
    endpoints: matching.length,
    withStructuredOutputs: matching.filter((endpoint) =>
      endpoint.supported_parameters?.includes('structured_outputs')
    ).length,
    providers: [
      ...new Set(matching.map((endpoint) => endpoint.provider_name))
    ].sort()
  };
}

export interface CaseResult {
  caseId: string;
  outcome: TranslationOutcome['kind'];
  failure: { kind: string; pause?: string; reason: string } | null;
  translation: DocumentTranslation | null;
  rejections: ReplyRejection[];
  servedModels: string[];
  costUsd: number;
  durationMs: number;
  detection: Record<Field, boolean> | null;
  /** `<language> <field>` where the model changed what a person keeps. */
  overTranslated: string[];
  /** `<language> <field>` where the model kept what a person changes. */
  underTranslated: string[];
}

export function scoreCase(
  evaluationCase: EvaluationCase,
  outcome: TranslationOutcome,
  durationMs: number
): CaseResult {
  const translation = outcome.kind === 'success' ? outcome.translation : null;
  const overTranslated: string[] = [];
  const underTranslated: string[] = [];

  if (translation) {
    for (const locale of LOCALES) {
      for (const field of ['name', 'description'] as const) {
        const expectation = evaluationCase.expected[locale]?.[field];
        const changed = (translation.texts[locale]?.[field] ?? null) !== null;
        if (expectation === 'keep' && changed) {
          overTranslated.push(`${locale} ${field}`);
        }
        if (expectation === 'translate' && !changed) {
          underTranslated.push(`${locale} ${field}`);
        }
      }
    }
  }

  return {
    caseId: evaluationCase.id,
    outcome: outcome.kind,
    failure:
      outcome.kind === 'success'
        ? null
        : {
            kind: outcome.kind,
            pause: outcome.kind === 'system' ? outcome.pause : undefined,
            reason: outcome.reason
          },
    translation,
    rejections: outcome.rejections,
    servedModels: [
      ...new Set(
        outcome.calls.flatMap((call) => (call.model ? [call.model] : []))
      )
    ],
    costUsd: outcome.calls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0),
    durationMs,
    detection: translation
      ? {
          name: evaluationCase.languages.name.includes(
            translation.nameLanguage
          ),
          description: evaluationCase.languages.description.includes(
            translation.descriptionLanguage
          )
        }
      : null,
    overTranslated,
    underTranslated
  };
}

export interface ModelReport {
  /** The `model` string sent. */
  model: string;
  /** The candidate it names, or null for the preset's own model. */
  candidate: string | null;
  zdr: Record<string, ZdrSummary>;
  totals: {
    cases: number;
    success: number;
    document: number;
    transient: number;
    system: number;
    parseRejections: number;
    schemaRejections: number;
    checkRejections: number;
    detectionMisses: number;
    overTranslated: number;
    underTranslated: number;
    costUsd: number;
  };
  cases: CaseResult[];
}

export function totalsOf(results: CaseResult[]): ModelReport['totals'] {
  const count = (predicate: (result: CaseResult) => boolean) =>
    results.filter(predicate).length;
  const rejections = (stage: ReplyRejection['stage']) =>
    results.reduce(
      (sum, result) =>
        sum + result.rejections.filter((r) => r.stage === stage).length,
      0
    );
  return {
    cases: results.length,
    success: count((r) => r.outcome === 'success'),
    document: count((r) => r.outcome === 'document'),
    transient: count((r) => r.outcome === 'transient'),
    system: count((r) => r.outcome === 'system'),
    parseRejections: rejections('parse'),
    schemaRejections: rejections('schema'),
    checkRejections: rejections('check'),
    detectionMisses: results.reduce(
      (sum, r) =>
        sum +
        (r.detection
          ? Number(!r.detection.name) + Number(!r.detection.description)
          : 0),
      0
    ),
    overTranslated: results.reduce((s, r) => s + r.overTranslated.length, 0),
    underTranslated: results.reduce((s, r) => s + r.underTranslated.length, 0),
    costUsd: results.reduce((s, r) => s + r.costUsd, 0)
  };
}

export interface EvaluationReport {
  generatedAt: string;
  preset: string;
  cases: EvaluationCase[];
  models: ModelReport[];
}

const cell = (text: string | null | undefined) =>
  text == null ? '–' : text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** A fence no backtick run inside the text can close. */
function fenced(text: string): string {
  const longest = Math.max(
    2,
    ...[...text.matchAll(/`+/g)].map((match) => match[0].length)
  );
  const fence = '`'.repeat(longest + 1);
  return `${fence}markdown\n${text}\n${fence}`;
}

/**
 * The report as a reviewer reads it: the totals first, then every case with
 * the human versions beside each model's, names in a table and descriptions
 * folded away.
 */
export function renderMarkdown(report: EvaluationReport): string {
  const lines: string[] = [
    '# Translation evaluation',
    '',
    `Preset \`${report.preset}\`, ${report.generatedAt}, ${report.cases.length} cases.`,
    '',
    'Over-translated counts a field a person keeps that the model changed; under-translated, the reverse. ' +
      'The first is the worse error: it misleads a reader, where the second costs them a click.',
    '',
    '| model | ok | document | transient | system | rejected (parse / schema / check) | detection misses | over-translated | under-translated | cost (USD) |',
    '| ----- | -- | -------- | --------- | ------ | --------------------------------- | ---------------- | --------------- | ---------------- | ---------- |'
  ];
  for (const model of report.models) {
    const t = model.totals;
    lines.push(
      `| \`${model.model}\` | ${t.success}/${t.cases} | ${t.document} | ${t.transient} | ${t.system} | ` +
        `${t.parseRejections} / ${t.schemaRejections} / ${t.checkRejections} | ${t.detectionMisses} | ` +
        `**${t.overTranslated}** | ${t.underTranslated} | ${t.costUsd.toFixed(4)} |`
    );
  }

  lines.push('', '## Zero-retention endpoints', '');
  lines.push(
    '| model | endpoints | with structured outputs | providers |',
    '| ----- | --------- | ----------------------- | --------- |'
  );
  for (const model of report.models) {
    for (const [id, zdr] of Object.entries(model.zdr)) {
      lines.push(
        `| \`${id}\` | ${zdr.endpoints} | ${zdr.withStructuredOutputs} | ${cell(zdr.providers.join(', ')) || '–'} |`
      );
    }
  }

  lines.push('', '## Cases');
  for (const evaluationCase of report.cases) {
    lines.push(
      '',
      `### ${evaluationCase.id} (${evaluationCase.kind})`,
      '',
      `Name \`${cell(evaluationCase.input.name)}\`, hint \`${evaluationCase.input.hint ?? 'none'}\`, ` +
        `expected languages: name ${evaluationCase.languages.name.join(' or ')}, ` +
        `description ${evaluationCase.languages.description.join(' or ')}.`
    );
    if (evaluationCase.note) lines.push('', evaluationCase.note);
    if (evaluationCase.input.description) {
      lines.push(
        '',
        '<details><summary>Original description</summary>',
        '',
        fenced(evaluationCase.input.description),
        '',
        '</details>'
      );
    }

    lines.push(
      '',
      `| | detected | ${LOCALES.join(' | ')} | issues |`,
      `| - | -------- | ${LOCALES.map(() => '--').join(' | ')} | ------ |`,
      `| human | ${evaluationCase.language} | ${LOCALES.map((locale) =>
        locale === evaluationCase.language
          ? `_${cell(evaluationCase.input.name)}_`
          : cell(evaluationCase.reference[locale]?.name)
      ).join(' | ')} | |`
    );
    for (const model of report.models) {
      const result = model.cases.find((r) => r.caseId === evaluationCase.id);
      if (!result) continue;
      lines.push(caseRow(model.model, result));
    }

    for (const model of report.models) {
      const result = model.cases.find((r) => r.caseId === evaluationCase.id);
      const texts = result?.translation?.texts ?? {};
      const described = LOCALES.filter((locale) => texts[locale]?.description);
      const human = LOCALES.filter(
        (locale) => evaluationCase.reference[locale]?.description
      );
      if (described.length === 0 && human.length === 0) continue;

      lines.push(
        '',
        `<details><summary>Descriptions: <code>${model.model}</code></summary>`
      );
      for (const locale of LOCALES) {
        const machine = texts[locale]?.description;
        const reference = evaluationCase.reference[locale]?.description;
        if (!machine && !reference) continue;
        lines.push('', `**${locale}**, model:`, '');
        lines.push(
          machine
            ? fenced(machine)
            : result?.translation
              ? '_kept as written_'
              : '_not translated: the call failed_'
        );
        if (reference)
          lines.push('', `**${locale}**, human:`, '', fenced(reference));
      }
      lines.push('', '</details>');
    }
  }

  return `${lines.join('\n')}\n`;
}

function caseRow(model: string, result: CaseResult): string {
  if (!result.translation) {
    const failure = result.failure;
    return `| \`${model}\` | – | ${LOCALES.map(() => '–').join(' | ')} | ${cell(
      `${failure?.kind}${failure?.pause ? ` (${failure.pause})` : ''}: ${failure?.reason}`
    )} |`;
  }

  const { translation } = result;
  const issues = [
    ...(result.detection && !result.detection.name ? ['name language'] : []),
    ...(result.detection && !result.detection.description
      ? ['description language']
      : []),
    ...result.overTranslated.map((entry) => `**over: ${entry}**`),
    ...result.underTranslated.map((entry) => `under: ${entry}`),
    ...result.rejections.map((r) => `retried (${r.stage})`)
  ];
  const names = LOCALES.map((locale: Locale) =>
    cell(translation.texts[locale]?.name ?? '·')
  );
  return (
    `| \`${model}\` | ${translation.nameLanguage} / ${translation.descriptionLanguage} | ` +
    `${names.join(' | ')} | ${issues.join(', ')} |`
  );
}
