import { Logger, type LoggerService } from '@nestjs/common';
import {
  BLOCKED_VERDICT,
  isStricter,
  type ModerationVerdict
} from '../../moderation/moderation-verdict';
import {
  analysisRetryMessage,
  analysisUserMessage,
  TEXT_ANALYSIS_SYSTEM_PROMPT
} from '../analysis-prompt';
import {
  ANALYSIS_REPLY_JSON_SCHEMA,
  readAnalysisReply
} from '../analysis-reply';
import type {
  AnalysisFailure,
  AnalysisInput,
  AnalysisOutcome,
  CallUsage,
  KeyBudget,
  ReplyRejection,
  TextAnalyzer
} from '../text-analyzer';
import {
  classifyOpenRouterFailure,
  parseRetryAfter
} from './openrouter-failure';

/**
 * Global routing: `eu.openrouter.ai` keeps traffic in the EU only on Business
 * and Enterprise plans, so the region is not configurable.
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai';

/** One call's ceiling. A slow reasoning model answers within it, a hung one does not. */
const CALL_TIMEOUT_MS = 60_000;

/**
 * What the key has to have left before another call is started. Above one
 * call's cost on every model worth choosing, so a call started inside the
 * budget finishes inside it too, retry included.
 */
const CALL_RESERVE_USD = 0.05;

export interface OpenRouterClientOptions {
  apiKey: string;
  /** The preset's slug; requests name `@preset/<slug>`. */
  preset: string;
  /** Sent as `HTTP-Referer`, which is how OpenRouter attributes calls to the app. */
  publicUrl: string;
  /**
   * The `model` string, in place of `@preset/<slug>`. Comparing candidates
   * sends `<candidate>@preset/<slug>`, which keeps the preset's routing and
   * tuning and swaps only the model.
   */
  model?: string;
  fetch?: typeof fetch;
  logger?: Pick<LoggerService, 'log' | 'warn'>;
}

/**
 * The chat-completions body, and everything in it. It names the preset and
 * nothing the preset owns: no `provider`, which would replace the preset's
 * routing, `require_parameters` with it, rather than add to it; no sampling parameters, which `require_parameters` would turn
 * into a filter that drops every endpoint lacking one; no `reasoning`. Only a
 * system and a user message, since several model families refuse an
 * assistant prefill, and no tools.
 */
export function buildCompletionRequest(
  model: string,
  input: AnalysisInput,
  retryReason?: string
): Record<string, unknown> {
  const messages = [
    { role: 'system', content: TEXT_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: analysisUserMessage(input) }
  ];
  if (retryReason !== undefined) {
    messages.push({
      role: 'user',
      content: analysisRetryMessage(retryReason)
    });
  }

  return {
    model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'document_translation',
        strict: true,
        schema: ANALYSIS_REPLY_JSON_SCHEMA
      }
    }
  };
}

/**
 * Every request's headers. The referer and the title are OpenRouter's app
 * attribution, which files the key's usage under Logigator.
 */
function openRouterHeaders(
  apiKey: string,
  publicUrl: string
): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': publicUrl,
    'X-OpenRouter-Title': 'Logigator'
  };
}

/** What one call produced: the reply's text, or a classified failure. */
interface Completion {
  result: { kind: 'content'; content: string } | AnalysisFailure;
  usage: CallUsage | null;
  /** Whether the provider's filter or the model itself declined the text. */
  blocked: boolean;
}

/**
 * Text analysis through OpenRouter. Model-generic by construction: the model,
 * its fallbacks and its tuning are the preset's, so nothing here names a
 * model, a provider or a reasoning level.
 *
 * No endpoint is trusted to honour the schema — on some it is only a strong
 * hint — so every reply is parsed and checked here, and a refused one is
 * retried once with the reason named before it counts against the document.
 *
 * The moderation verdict is read from every reply that matches the schema,
 * whatever becomes of its translation, and the strictest of the two attempts
 * is the one returned: a retry is a second reading of the same text, and a
 * milder second opinion is no reason to forget the first.
 */
export class OpenRouterClient implements TextAnalyzer {
  private readonly model: string;
  private readonly fetch: typeof fetch;
  private readonly logger: Pick<LoggerService, 'log' | 'warn'>;

  constructor(private readonly options: OpenRouterClientOptions) {
    this.model = options.model ?? `@preset/${options.preset}`;
    this.fetch = options.fetch ?? fetch;
    this.logger = options.logger ?? new Logger(OpenRouterClient.name);
  }

  async analyze(
    input: AnalysisInput,
    documentId: string
  ): Promise<AnalysisOutcome> {
    const calls: CallUsage[] = [];
    const rejections: ReplyRejection[] = [];
    let verdict: ModerationVerdict | null = null;
    let verdictCall: CallUsage | null = null;
    const accounted = () => ({ calls, rejections, verdict, verdictCall });

    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await this.complete(
        buildCompletionRequest(this.model, input, rejections.at(-1)?.reason),
        documentId
      );
      if (completion.usage) calls.push(completion.usage);

      const { result } = completion;
      // A declined text is likelier than any other to break the rules, and
      // the one whose reply carries no verdict to say so.
      if (completion.blocked && isStricter(BLOCKED_VERDICT, verdict)) {
        verdict = BLOCKED_VERDICT;
        verdictCall = completion.usage;
      }
      if (result.kind !== 'content') {
        this.logger.warn(
          `Analysis of ${documentId} failed (${describeFailure(result)}): ${result.reason}`
        );
        return { ...result, ...accounted() };
      }

      const read = readAnalysisReply(result.content, input);
      if (read.verdict && isStricter(read.verdict, verdict)) {
        verdict = read.verdict;
        verdictCall = completion.usage;
      }
      if (read.verdict && read.verdict.category !== 'none') {
        // The category and nothing else: the note is the model's words over
        // the author's text, and stays with the report.
        this.logger.log(
          `Moderation verdict for ${documentId}: ${read.verdict.category}` +
            (read.verdict.certain ? ', certain' : ', not certain')
        );
      }
      if (read.ok) {
        return {
          kind: 'success',
          translation: read.translation,
          model: completion.usage?.model ?? null,
          ...accounted(),
          // Never the fallback: the reply's own verdict was taken above
          // unless a stricter one was already held.
          verdict: verdict ?? read.verdict
        };
      }

      rejections.push(read.rejection);
      this.logger.warn(
        `Analysis reply for ${documentId} refused (${read.rejection.stage}): ${read.rejection.reason}`
      );
    }

    return {
      kind: 'document',
      reason: `the reply was refused twice; last: ${rejections.at(-1)?.reason}`,
      ...accounted()
    };
  }

  /**
   * The key's remaining daily budget, from `GET /api/v1/key`. A key with no
   * limit reads as available with no figure.
   */
  async readBudget(): Promise<KeyBudget> {
    let response: Response;
    let body: unknown;
    try {
      response = await this.fetch(`${OPENROUTER_BASE_URL}/api/v1/key`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
      });
      body = await response.json().catch(() => undefined);
    } catch (error) {
      return { kind: 'unavailable', reason: describeError(error) };
    }

    if (response.status === 401 || response.status === 403) {
      return { kind: 'refused', status: response.status };
    }
    if (!response.ok) {
      return {
        kind: 'unavailable',
        reason: `OpenRouter answered ${response.status}`
      };
    }

    const remaining = (body as { data?: { limit_remaining?: unknown } })?.data
      ?.limit_remaining;
    if (remaining === null) return { kind: 'available', remainingUsd: null };
    if (typeof remaining !== 'number') {
      return {
        kind: 'unavailable',
        reason: 'the key endpoint answered without limit_remaining'
      };
    }
    return remaining >= CALL_RESERVE_USD
      ? { kind: 'available', remainingUsd: remaining }
      : { kind: 'exhausted', remainingUsd: remaining };
  }

  private headers(): Record<string, string> {
    return openRouterHeaders(this.options.apiKey, this.options.publicUrl);
  }

  private async complete(
    request: Record<string, unknown>,
    documentId: string
  ): Promise<Completion> {
    let response: Response;
    let body: unknown;
    try {
      response = await this.fetch(
        `${OPENROUTER_BASE_URL}/api/v1/chat/completions`,
        {
          method: 'POST',
          headers: { ...this.headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
        }
      );
      // Read inside the same guard: the timeout covers the body too, and a
      // body cut off mid-way is the route failing rather than the reply. A
      // body that arrives whole but is not JSON, such as a proxy's error
      // page, is left to the status to classify.
      body = parseJson(await response.text());
    } catch (error) {
      return {
        result: {
          kind: 'transient',
          reason: describeError(error),
          retryAfterSeconds: null
        },
        usage: null,
        blocked: false
      };
    }

    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    if (!response.ok) {
      return {
        result: classifyOpenRouterFailure(response.status, body, retryAfter),
        usage: null,
        blocked: false
      };
    }

    const { usage, choice } = readCompletion(body);
    if (usage) this.logUsage(usage, documentId);
    return {
      result: classifyChoice(choice, body, retryAfter),
      usage,
      blocked:
        choice !== null &&
        (choice.finishReason === 'content_filter' || choice.refusal)
    };
  }

  private logUsage(usage: CallUsage, documentId: string): void {
    this.logger.log(
      `Analysis call for ${documentId}: ${usage.model ?? 'unknown model'} ` +
        `via ${usage.provider ?? 'unknown provider'}, ` +
        `${usage.promptTokens ?? '?'} prompt (${usage.cachedTokens ?? '?'} cached) + ` +
        `${usage.completionTokens ?? '?'} completion tokens, ` +
        `$${usage.costUsd ?? '?'} (${usage.generationId ?? 'no generation id'})`
    );
  }
}

/** The fields of a completion this client reads, each checked for its type. */
interface Choice {
  finishReason: unknown;
  content: string | null;
  refusal: boolean;
}

/** What a `200` amounts to: the reply's text, or why there is none to read. */
function classifyChoice(
  choice: Choice | null,
  body: unknown,
  retryAfter: number | null
): Completion['result'] {
  if (!choice) {
    // A `200` whose body is only an error: the failure happened after the
    // status was sent, and the error's code says which one it was.
    const code = (body as { error?: { code?: unknown } } | undefined)?.error
      ?.code;
    return typeof code === 'number'
      ? classifyOpenRouterFailure(code, body, retryAfter)
      : {
          kind: 'transient',
          reason: 'OpenRouter answered 200 without a choice',
          retryAfterSeconds: retryAfter
        };
  }

  switch (choice.finishReason) {
    case 'length':
      // The token cap ran out, often all of it on reasoning. The same request
      // would run out the same way.
      return { kind: 'document', reason: 'the reply hit the token limit' };
    case 'content_filter':
      return {
        kind: 'document',
        reason: 'the provider filtered the reply'
      };
    case 'error':
      return {
        kind: 'transient',
        reason: 'the provider failed mid-reply',
        retryAfterSeconds: retryAfter
      };
  }
  if (choice.refusal) {
    return { kind: 'document', reason: 'the model refused the text' };
  }
  return { kind: 'content', content: choice.content ?? '' };
}

function readCompletion(body: unknown): {
  usage: CallUsage | null;
  choice: Choice | null;
} {
  if (typeof body !== 'object' || body === null) {
    return { usage: null, choice: null };
  }
  const record = body as Record<string, unknown>;
  const usage = record['usage'] as Record<string, unknown> | undefined;
  const promptDetails = usage?.['prompt_tokens_details'] as
    Record<string, unknown> | undefined;
  const served = 'usage' in record || 'model' in record;
  const choices = record['choices'];
  const first = Array.isArray(choices)
    ? (choices[0] as Record<string, unknown> | undefined)
    : undefined;
  const message = first?.['message'] as Record<string, unknown> | undefined;

  return {
    usage: served
      ? {
          model: stringOrNull(record['model']),
          provider: stringOrNull(record['provider']),
          generationId: stringOrNull(record['id']),
          costUsd: numberOrNull(usage?.['cost']),
          promptTokens: numberOrNull(usage?.['prompt_tokens']),
          cachedTokens: numberOrNull(promptDetails?.['cached_tokens']),
          completionTokens: numberOrNull(usage?.['completion_tokens'])
        }
      : null,
    choice: first
      ? {
          finishReason: first['finish_reason'],
          content: stringOrNull(message?.['content']),
          refusal: Boolean(stringOrNull(message?.['refusal']))
        }
      : null
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `no answer within ${CALL_TIMEOUT_MS / 1000} s`;
  }
  return `the request failed: ${error instanceof Error ? error.message : String(error)}`;
}

function describeFailure(failure: AnalysisFailure): string {
  return failure.kind === 'system' ? `system, ${failure.pause}` : failure.kind;
}
