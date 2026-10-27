import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../common/locale';
import type { ModerationVerdict } from '../../moderation/moderation-verdict';
import { ANALYSIS_REPLY_JSON_SCHEMA } from '../analysis-reply';
import type { AnalysisInput } from '../text-analyzer';
import {
  buildCompletionRequest,
  OpenRouterClient,
  type OpenRouterClientOptions
} from './openrouter.client';

const INPUT: AnalysisInput = {
  name: 'Full Adder',
  description: 'Adds three bits. Secret wording 7f3a.',
  hint: 'en',
  versions: [
    { language: 'de', name: 'Volladdierer', description: null },
    { language: 'fr', name: null, description: 'Additionne trois bits.' }
  ]
};

const CLEAN: ModerationVerdict = { category: 'none', certain: false, note: '' };

/** A reply that matches the schema, the German description as given. */
function content(
  moderation: ModerationVerdict = CLEAN,
  deDescription = 'Addiert drei Bits.'
): string {
  return JSON.stringify({
    nameLanguage: 'en',
    descriptionLanguage: 'en',
    translations: Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        locale === 'de'
          ? { name: 'Volladdierer', description: deDescription }
          : { name: null, description: null }
      ])
    ),
    moderation
  });
}

const VALID_CONTENT = content();

/** A description `translation-check` refuses: it adds a link. */
const INJECTED = 'Addiert drei Bits. [Mehr](https://evil.example)';

function completion(
  content: string | null,
  finishReason = 'stop',
  generationId = 'gen-1'
): Record<string, unknown> {
  return {
    id: generationId,
    model: 'vendor/served-model-20261001',
    provider: 'SomeProvider',
    choices: [{ finish_reason: finishReason, message: { content } }],
    usage: {
      prompt_tokens: 600,
      prompt_tokens_details: { cached_tokens: 512 },
      completion_tokens: 120,
      cost: 0.0004
    }
  };
}

interface FakeCall {
  url: string;
  init: RequestInit | undefined;
  body: Record<string, unknown> | undefined;
}

/**
 * A `fetch` answering from a script, one response per call, and recording
 * what was sent. A thrown value stands for a network failure.
 */
function fakeFetch(...script: (Response | Error)[]) {
  const calls: FakeCall[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init,
      body:
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined
    });
    const next = script.shift();
    if (!next) throw new Error('unexpected call');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (status: number, body: unknown, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

function client(
  fetch: typeof globalThis.fetch,
  overrides: Partial<OpenRouterClientOptions> = {}
) {
  const logs: string[] = [];
  const record = (message: unknown) => {
    logs.push(String(message));
  };
  return {
    logs,
    client: new OpenRouterClient({
      apiKey: 'sk-or-test',
      preset: 'logigator-dev',
      publicUrl: 'https://logigator.test',
      fetch,
      logger: { log: record, warn: record },
      ...overrides
    })
  };
}

describe('buildCompletionRequest', () => {
  it('carries nothing that could override the preset or its privacy settings', () => {
    const body = buildCompletionRequest('@preset/logigator', INPUT, 'retry');

    // `provider` would replace the preset's routing whole, the privacy filters
    // and `require_parameters` with it; sampling parameters would turn into
    // endpoint filters; reasoning is the preset's.
    expect(Object.keys(body).sort()).toEqual(
      ['messages', 'model', 'response_format'].sort()
    );
  });

  it('sends system and user messages only, the document as JSON data', () => {
    const body = buildCompletionRequest('@preset/logigator', INPUT, 'retry');
    const messages = body['messages'] as { role: string; content: string }[];

    expect(messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'user'
    ]);
    expect(JSON.parse(messages[1].content)).toEqual(INPUT);
  });

  it('keeps the system prompt identical across documents', () => {
    // A prefix that varies per document is a prefix no provider can cache.
    const first = buildCompletionRequest('m', INPUT);
    const second = buildCompletionRequest('m', {
      name: 'CPU',
      description: '',
      hint: null,
      versions: []
    });
    const system = (body: Record<string, unknown>) =>
      (body['messages'] as { content: string }[])[0].content;

    expect(system(first)).toBe(system(second));
  });

  it('asks for the reply schema in strict mode', () => {
    const body = buildCompletionRequest('m', INPUT);
    expect(body['response_format']).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'document_translation',
        strict: true,
        schema: ANALYSIS_REPLY_JSON_SCHEMA
      }
    });
  });
});

describe('OpenRouterClient.analyze', () => {
  it('names the preset, attributes the app and authenticates', async () => {
    const { fetch, calls } = fakeFetch(json(200, completion(VALID_CONTENT)));
    await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].body?.['model']).toBe('@preset/logigator-dev');
    expect(calls[0].init?.headers).toMatchObject({
      Authorization: 'Bearer sk-or-test',
      'HTTP-Referer': 'https://logigator.test',
      'X-OpenRouter-Title': 'Logigator'
    });
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends a candidate model in place of the preset when told to', async () => {
    const { fetch, calls } = fakeFetch(json(200, completion(VALID_CONTENT)));
    await client(fetch, {
      model: 'vendor/candidate@preset/logigator-dev'
    }).client.analyze(INPUT, 'doc-1');

    expect(calls[0].body?.['model']).toBe(
      'vendor/candidate@preset/logigator-dev'
    );
  });

  it('returns the translation with the served model, not the preset', async () => {
    const { fetch } = fakeFetch(json(200, completion(VALID_CONTENT)));
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome).toMatchObject({
      kind: 'success',
      model: 'vendor/served-model-20261001',
      translation: {
        texts: {
          de: { name: 'Volladdierer', description: 'Addiert drei Bits.' }
        }
      }
    });
    expect(outcome.calls).toHaveLength(1);
    expect(outcome.calls[0].costUsd).toBe(0.0004);
    expect(outcome.calls[0].cachedTokens).toBe(512);
  });

  it('retries a schema-invalid reply once, naming what was wrong', async () => {
    const { fetch, calls } = fakeFetch(
      json(200, completion('{"nameLanguage":"English"}')),
      json(200, completion(VALID_CONTENT))
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('success');
    expect(outcome.rejections).toHaveLength(1);
    const retry = calls[1].body?.['messages'] as { content: string }[];
    expect(retry).toHaveLength(3);
    expect(retry[2].content).toContain(outcome.rejections[0].reason);
  });

  it('counts a reply refused twice against the document', async () => {
    const { fetch, calls } = fakeFetch(
      json(200, completion('not json')),
      json(200, completion('{"nameLanguage":"English"}'))
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('document');
    expect(calls).toHaveLength(2);
    // Both calls were paid for, and both are accounted.
    expect(outcome.calls).toHaveLength(2);
    // Neither reply got as far as a verdict.
    expect(outcome.verdict).toBeNull();
    expect(outcome.verdictCall).toBeNull();
  });

  it('retries a translation the check refuses', async () => {
    const injected = content(CLEAN, INJECTED);
    const { fetch } = fakeFetch(
      json(200, completion(injected)),
      json(200, completion(injected))
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('document');
    expect(outcome.rejections.map((rejection) => rejection.stage)).toEqual([
      'check',
      'check'
    ]);
  });

  it('returns the verdict with the call that gave it', async () => {
    const flagged: ModerationVerdict = {
      category: 'spam',
      certain: false,
      note: 'Links to a shop.'
    };
    const { fetch } = fakeFetch(json(200, completion(content(flagged))));
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('success');
    expect(outcome.verdict).toEqual(flagged);
    expect(outcome.verdictCall?.generationId).toBe('gen-1');
  });

  it('keeps the verdict of replies whose translation is refused', async () => {
    // A text that always fails the check still gets judged.
    const harassment: ModerationVerdict = {
      category: 'harassment',
      certain: true,
      note: 'Threatens a named person.'
    };
    const { fetch } = fakeFetch(
      json(200, completion(content(harassment, INJECTED))),
      json(200, completion(content(harassment, INJECTED)))
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('document');
    expect(outcome.verdict).toEqual(harassment);
  });

  it.each<[string, ModerationVerdict, ModerationVerdict, 'first' | 'second']>([
    [
      'a stricter second verdict replaces the first',
      { category: 'spam', certain: true, note: 'An ad.' },
      { category: 'illegal', certain: false, note: 'Sells something.' },
      'second'
    ],
    [
      'an equally strict second verdict does not',
      { category: 'other', certain: false, note: 'First.' },
      { category: 'spam', certain: false, note: 'Second.' },
      'first'
    ]
  ])(
    'keeps the stricter verdict across a retry, with its call: %s',
    async (_, first, second, kept) => {
      const { fetch } = fakeFetch(
        json(200, completion(content(first, INJECTED), 'stop', 'gen-first')),
        json(200, completion(content(second), 'stop', 'gen-second'))
      );
      const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

      expect(outcome.kind).toBe('success');
      expect(outcome.verdict).toEqual(kept === 'first' ? first : second);
      expect(outcome.verdictCall?.generationId).toBe(`gen-${kept}`);
    }
  );

  it('keeps the verdict when the retry fails on the route', async () => {
    const illegal: ModerationVerdict = {
      category: 'illegal',
      certain: true,
      note: 'Offers drugs.'
    };
    const { fetch } = fakeFetch(
      json(200, completion(content(illegal, INJECTED))),
      json(429, { error: { code: 429, message: 'slow down' } })
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('transient');
    expect(outcome.verdict).toEqual(illegal);
  });

  it('counts a reply cut off at the token limit against the document, without a retry', async () => {
    const { fetch, calls } = fakeFetch(json(200, completion(null, 'length')));
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('document');
    expect(calls).toHaveLength(1);
  });

  it('counts a filtered reply against the document and puts it before a person', async () => {
    const { fetch } = fakeFetch(json(200, completion(null, 'content_filter')));
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('document');
    // No category was given, so it is reported and never hidden.
    expect(outcome.verdict).toMatchObject({
      category: 'other',
      certain: false
    });
    expect(outcome.verdictCall?.generationId).toBe('gen-1');
  });

  it('reports a text the model refuses', async () => {
    const { fetch } = fakeFetch(
      json(200, {
        ...completion(null),
        choices: [{ finish_reason: 'stop', message: { refusal: 'No.' } }]
      })
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome.kind).toBe('document');
    expect(outcome.verdict).toMatchObject({
      category: 'other',
      certain: false
    });
  });

  it('gives a reply cut off at the token limit no verdict', async () => {
    const { fetch } = fakeFetch(json(200, completion(null, 'length')));
    expect(
      (await client(fetch).client.analyze(INPUT, 'doc-1')).verdict
    ).toBeNull();
  });

  it('treats a provider failing mid-reply as transient', async () => {
    const { fetch } = fakeFetch(json(200, completion(null, 'error')));
    expect((await client(fetch).client.analyze(INPUT, 'doc-1')).kind).toBe(
      'transient'
    );
  });

  it('classifies a 200 carrying only an error by its code', async () => {
    const errorOnly = (code: number) =>
      json(200, { error: { code, message: 'failed after the status' } });
    const { fetch } = fakeFetch(errorOnly(502), errorOnly(402), errorOnly(401));
    const { client: analyzer } = client(fetch);

    expect((await analyzer.analyze(INPUT, 'doc-1')).kind).toBe('transient');
    expect(await analyzer.analyze(INPUT, 'doc-1')).toMatchObject({
      kind: 'system',
      pause: 'budget'
    });
    expect(await analyzer.analyze(INPUT, 'doc-1')).toMatchObject({
      kind: 'system',
      pause: 'configuration'
    });
  });

  it('treats 429 as transient, with the server’s Retry-After, and retries nothing', async () => {
    const { fetch, calls } = fakeFetch(
      json(
        429,
        { error: { code: 429, message: 'slow down' } },
        {
          'Retry-After': '17'
        }
      )
    );
    const outcome = await client(fetch).client.analyze(INPUT, 'doc-1');

    expect(outcome).toMatchObject({ kind: 'transient', retryAfterSeconds: 17 });
    expect(calls).toHaveLength(1);
  });

  it('treats a network failure and a timeout as transient', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const { fetch } = fakeFetch(new TypeError('fetch failed'), timeout);
    const { client: analyzer } = client(fetch);

    expect((await analyzer.analyze(INPUT, 'doc-1')).kind).toBe('transient');
    expect((await analyzer.analyze(INPUT, 'doc-1')).kind).toBe('transient');
  });

  it('reports a reply whose body the timeout cut off as a timeout', async () => {
    // OpenRouter answers 200 at once and keeps the connection open while the
    // model works, so a slow model runs into the timeout inside the body.
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const stalled = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(' '));
          controller.error(timeout);
        }
      }),
      { status: 200 }
    );
    const { client: analyzer } = client(fakeFetch(stalled).fetch);

    const outcome = await analyzer.analyze(INPUT, 'doc-1');
    expect(outcome.kind).toBe('transient');
    expect(outcome.kind === 'transient' && outcome.reason).toMatch(
      /no answer within/
    );
  });

  it('counts a moderation 403 against the document', async () => {
    const { fetch } = fakeFetch(
      json(403, {
        error: {
          code: 403,
          message: 'Input was flagged',
          metadata: { reasons: ['violence'], flagged_input: '…' }
        }
      }),
      json(403, {
        error: {
          code: 403,
          message: 'refused',
          metadata: { error_type: 'content_policy_violation' }
        }
      })
    );
    const { client: analyzer } = client(fetch);

    expect((await analyzer.analyze(INPUT, 'doc-1')).kind).toBe('document');
    expect((await analyzer.analyze(INPUT, 'doc-1')).kind).toBe('document');
  });

  it('pauses for the budget on a spent key limit and on an empty account', async () => {
    // The bodies OpenRouter answers with: a key past its daily limit is a 403
    // that carries metadata but no moderation reasons, and an account without
    // credits is a 402.
    const { fetch } = fakeFetch(
      json(403, {
        error: {
          code: 403,
          message: 'Key limit exceeded (daily limit).',
          metadata: {
            limit_source: 'openrouter_key_limit',
            scope: 'key_limit',
            limit_usd: 0.01,
            spend_usd: 0.08,
            resets_at: '2026-10-22T00:00:00.000Z'
          }
        }
      }),
      json(402, {
        error: {
          code: 402,
          message: 'Insufficient credits.',
          metadata: { limit_source: 'openrouter_credits' }
        }
      })
    );
    const { client: analyzer } = client(fetch);

    for (let i = 0; i < 2; i++) {
      expect(await analyzer.analyze(INPUT, 'doc-1')).toMatchObject({
        kind: 'system',
        pause: 'budget'
      });
    }
  });

  it('pauses for the configuration on 400, 401 and an unroutable 503', async () => {
    const { fetch } = fakeFetch(
      json(400, { error: { code: 400, message: 'Preset not found' } }),
      json(401, { error: { code: 401, message: 'No auth' } }),
      json(503, {
        error: {
          code: 503,
          message: 'No available provider meets your routing requirements'
        }
      })
    );
    const { client: analyzer } = client(fetch);

    for (let i = 0; i < 3; i++) {
      expect(await analyzer.analyze(INPUT, 'doc-1')).toMatchObject({
        kind: 'system',
        pause: 'configuration'
      });
    }
  });

  it('treats an overloaded provider as transient', async () => {
    const { fetch } = fakeFetch(
      json(503, {
        error: {
          code: 503,
          message: 'overloaded',
          metadata: { error_type: 'provider_overloaded' }
        }
      })
    );
    expect((await client(fetch).client.analyze(INPUT, 'doc-1')).kind).toBe(
      'transient'
    );
  });

  it('logs the document id, the cost and the verdict, never a text or the note', async () => {
    const { fetch } = fakeFetch(
      json(200, completion('not json')),
      json(
        200,
        completion(
          content({
            category: 'harassment',
            certain: false,
            note: 'Calls somebody 7f3a.'
          })
        )
      )
    );
    const { client: analyzer, logs } = client(fetch);
    await analyzer.analyze(INPUT, 'doc-42');

    const all = logs.join('\n');
    expect(all).toContain('doc-42');
    expect(all).toContain('harassment');
    expect(all).toContain('0.0004');
    expect(all).toContain('512 cached');
    expect(all).toContain('vendor/served-model-20261001');
    expect(all).not.toContain('7f3a');
    expect(all).not.toContain('Volladdierer');
  });
});

describe('OpenRouterClient.readBudget', () => {
  const key = (limitRemaining: number | null) =>
    json(200, { data: { limit: 1, limit_remaining: limitRemaining } });

  it('reads the key’s remaining limit', async () => {
    const { fetch, calls } = fakeFetch(key(0.8), key(0.001), key(null));
    const { client: analyzer } = client(fetch);

    expect(await analyzer.readBudget()).toEqual({
      kind: 'available',
      remainingUsd: 0.8
    });
    expect(await analyzer.readBudget()).toMatchObject({ kind: 'exhausted' });
    // A key without a limit has no figure to run out of.
    expect(await analyzer.readBudget()).toEqual({
      kind: 'available',
      remainingUsd: null
    });
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/key');
  });

  it('tells a key the endpoint refuses apart from a spent budget', async () => {
    const { fetch } = fakeFetch(json(401, { error: { code: 401 } }));
    expect(await client(fetch).client.readBudget()).toEqual({
      kind: 'refused',
      status: 401
    });
  });

  it('reports an unreachable endpoint without guessing a budget', async () => {
    const { fetch } = fakeFetch(new TypeError('fetch failed'));
    expect((await client(fetch).client.readBudget()).kind).toBe('unavailable');
  });
});
