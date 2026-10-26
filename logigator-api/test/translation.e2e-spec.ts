import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { ProjectSummary } from '@logigator/contract';
import { projectTexts, projects } from '../src/database/schema';
import {
  startOfNextUtcDay,
  TRANSLATION_LEASE_MINUTES
} from '../src/translation/translation-lease';
import {
  claimPending,
  releaseClaim,
  renewForCall,
  settleTranslation
} from '../src/translation/translation-queries';
import type {
  CallUsage,
  KeyBudget,
  TranslationInput,
  TranslationOutcome,
  Translator
} from '../src/translation/translator';
import { circuitDocument, EMPTY_BODY, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp, type TranslationDriver } from './harness';

const SERVED_MODEL = 'fake/served-model';

const USAGE: CallUsage = {
  model: SERVED_MODEL,
  provider: 'fake',
  generationId: null,
  costUsd: 0,
  promptTokens: 1,
  cachedTokens: 0,
  completionTokens: 1
};

/** What the fake answers by default: an English original, translated. */
function translated(input: TranslationInput): TranslationOutcome {
  return {
    kind: 'success',
    model: SERVED_MODEL,
    calls: [USAGE],
    rejections: [],
    translation: {
      nameLanguage: 'en',
      descriptionLanguage: 'en',
      texts: {
        de: { name: null, description: `DE ${input.description}` },
        fr: { name: null, description: `FR ${input.description}` }
      }
    }
  };
}

type Answer = (
  input: TranslationInput
) => TranslationOutcome | Promise<TranslationOutcome>;

const documentFailure: Answer = () => ({
  kind: 'document',
  reason: 'the reply was refused twice',
  calls: [USAGE, USAGE],
  rejections: []
});

/**
 * Stands in for OpenRouter. It answers {@link translated} unless a spec has
 * queued answers for a document, and records every call it is asked to make.
 */
class FakeTranslator implements Translator {
  readonly calls: { documentId: string; input: TranslationInput }[] = [];
  budget: KeyBudget = { kind: 'available', remainingUsd: 1 };
  budgetReads = 0;
  private readonly queued = new Map<string, Answer[]>();

  answer(documentId: string, ...answers: Answer[]): void {
    this.queued.set(documentId, [
      ...(this.queued.get(documentId) ?? []),
      ...answers
    ]);
  }

  callsFor(documentId: string): TranslationInput[] {
    return this.calls
      .filter((call) => call.documentId === documentId)
      .map((call) => call.input);
  }

  async translate(
    input: TranslationInput,
    documentId: string
  ): Promise<TranslationOutcome> {
    this.calls.push({ documentId, input });
    const answer = this.queued.get(documentId)?.shift() ?? translated;
    return answer(input);
  }

  async readBudget(): Promise<KeyBudget> {
    this.budgetReads += 1;
    return this.budget;
  }
}

/** One spec file's application with its own members and helpers. */
function fixture(api: () => E2eApp) {
  async function signUp(email: string, username: string): Promise<CookieJar> {
    const password = 'lovelace1';
    const registered = await api().inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password }
    });
    expect(registered.statusCode).toBe(201);
    await api().inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api().mail.lastToken() }
    });
    const cookies = new CookieJar();
    cookies.store(
      await api().inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password }
      })
    );
    return cookies;
  }

  async function createProject(
    cookies: CookieJar,
    payload: Record<string, unknown> = {}
  ): Promise<ProjectSummary> {
    const name = (payload['name'] as string | undefined) ?? 'Full Adder';
    const response = await api().inject({
      method: 'POST',
      url: '/api/projects',
      headers: cookies.headers(),
      payload: {
        name,
        description: 'Adds three bits.',
        visibility: 'public',
        document: circuitDocument(name, HALF_ADDER_BODY),
        ...payload
      }
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function patchProject(
    cookies: CookieJar,
    id: string,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
  ): Promise<void> {
    const response = await api().inject({
      method: 'PATCH',
      url: `/api/projects/${id}`,
      headers: { ...cookies.headers(), ...headers },
      payload
    });
    expect(response.statusCode).toBe(200);
  }

  async function row(id: string) {
    const [found] = await api()
      .db.select()
      .from(projects)
      .where(eq(projects.id, id));
    return found;
  }

  async function machineRows(id: string) {
    return api()
      .db.select()
      .from(projectTexts)
      .where(
        and(eq(projectTexts.documentId, id), eq(projectTexts.origin, 'machine'))
      );
  }

  function detail(link: string, lang: string) {
    return api().inject({
      method: 'GET',
      url: `/api/community/projects/${link}?lang=${lang}`
    });
  }

  function translation(link: string, lang: string) {
    return api().inject({
      method: 'GET',
      url: `/api/community/projects/${link}/translation/${lang}`
    });
  }

  return {
    signUp,
    createProject,
    patchProject,
    row,
    machineRows,
    detail,
    translation
  };
}

function driverOf(api: E2eApp): TranslationDriver {
  if (!api.translation) throw new Error('The worker is not registered.');
  return api.translation;
}

describe('the translation worker', () => {
  let api: E2eApp;
  let worker: TranslationDriver;
  const fake = new FakeTranslator();
  const {
    signUp,
    createProject,
    patchProject,
    row,
    machineRows,
    detail,
    translation
  } = fixture(() => api);
  let ada: CookieJar;

  beforeAll(async () => {
    api = await startE2eApp({}, { translator: fake });
    worker = driverOf(api);
    ada = await signUp('ada@example.com', 'Ada');
  });

  afterAll(async () => {
    await api.close();
  });

  it('is scheduled, where the switched-off application has no interval', () => {
    expect(api.app.get(SchedulerRegistry).getIntervals()).toEqual([
      'translation-worker'
    ]);
  });

  it('translates a written description, and the reads offer it', async () => {
    const project = await createProject(ada, { description: '' });
    await patchProject(
      ada,
      project.id,
      { description: 'Adds three bits.' },
      { 'accept-language': 'de-DE,de;q=0.9' }
    );

    await worker.tick();

    // The writer's interface language travels as the hint, nothing more.
    expect(fake.callsFor(project.id)).toEqual([
      { name: 'Full Adder', description: 'Adds three bits.', hint: 'de' }
    ]);
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      description: 'Adds three bits.',
      textLanguage: { name: 'en', description: 'en' },
      machineTranslation: true
    });
    expect((await detail(project.link, 'en')).json()).toMatchObject({
      machineTranslation: false
    });

    const translatedRead = await translation(project.link, 'de');
    expect(translatedRead.statusCode).toBe(200);
    expect(translatedRead.json()).toMatchObject({
      language: 'de',
      name: null,
      description: 'DE Adds three bits.'
    });

    const stored = await row(project.id);
    expect(stored.translatedDigest).toBe(stored.textDigest);
    expect(stored.translationClaimedAt).toBeNull();
    for (const machine of await machineRows(project.id)) {
      expect(machine.sourceDigest).toBe(stored.textDigest);
      expect(machine.model).toBe(SERVED_MODEL);
    }
  });

  it('discards a result whose text was edited while it was translated', async () => {
    const project = await createProject(ada, { description: 'Counts up.' });
    fake.answer(project.id, async (input) => {
      await patchProject(ada, project.id, {
        description: 'Counts up and down.'
      });
      return translated(input);
    });

    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
    const stored = await row(project.id);
    expect(stored.translatedDigest).not.toBe(stored.textDigest);
    // Released at once, so the new text is not held up by the old claim.
    expect(stored.translationClaimedAt).toBeNull();
    expect(await machineRows(project.id)).toEqual([]);
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      textLanguage: { name: null, description: null },
      machineTranslation: false
    });

    await worker.tick();

    expect(fake.callsFor(project.id).at(-1)?.description).toBe(
      'Counts up and down.'
    );
    expect((await translation(project.link, 'de')).json().description).toBe(
      'DE Counts up and down.'
    );
  });

  it('never sends a private document, and sends it once it is shared', async () => {
    const project = await createProject(ada, { visibility: 'private' });

    // The claim passes it by, not only the check made before each call.
    const claimed = await claimPending(api.db, projects, {
      debounceSeconds: 0,
      batch: 100
    });
    for (const claim of claimed) await releaseClaim(api.db, projects, claim);
    expect(claimed.map((claim) => claim.id)).not.toContain(project.id);

    await worker.tick();

    expect(fake.callsFor(project.id)).toEqual([]);
    expect((await row(project.id)).translationClaimedAt).toBeNull();

    await patchProject(ada, project.id, { visibility: 'unlisted' });
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
    // An unlisted document resolves for whoever holds the link.
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      machineTranslation: true
    });
  });

  it('passes an empty board by until something is drawn on it', async () => {
    const project = await createProject(ada, {
      document: circuitDocument('Blank board', EMPTY_BODY)
    });

    await worker.tick();

    expect(fake.callsFor(project.id)).toEqual([]);
    expect((await row(project.id)).translatedDigest).toBeNull();

    const drawn = await api.inject({
      method: 'PUT',
      url: `/api/projects/${project.id}`,
      headers: ada.headers(),
      payload: {
        version: project.version,
        document: circuitDocument('Blank board', HALF_ADDER_BODY)
      }
    });
    expect(drawn.statusCode).toBe(200);
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
  });

  it('does not send a document made private after it was claimed', async () => {
    const first = await createProject(ada, { name: 'Counter' });
    const second = await createProject(ada, { name: 'Decoder' });
    // Both are claimed in one batch; the second turns private while the
    // first is being translated.
    fake.answer(first.id, async (input) => {
      await patchProject(ada, second.id, { visibility: 'private' });
      return translated(input);
    });

    await worker.tick();

    expect(fake.callsFor(first.id)).toHaveLength(1);
    expect(fake.callsFor(second.id)).toEqual([]);
    const held = await row(second.id);
    expect(held.translationClaimedAt).toBeNull();
    expect(held.translatedDigest).toBeNull();
    expect(held.translationAttempts).toBe(0);
  });

  it('parks a text after three document failures, until it is edited', async () => {
    const project = await createProject(ada, { name: 'Multiplexer' });
    fake.answer(project.id, documentFailure, documentFailure, documentFailure);

    for (let tick = 0; tick < 3; tick++) await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(3);
    const parked = await row(project.id);
    expect(parked.translationAttempts).toBe(3);
    expect(parked.translationAttemptDigest).toBe(parked.textDigest);
    expect(parked.translationClaimedAt).toBeNull();

    await worker.tick();
    expect(fake.callsFor(project.id)).toHaveLength(3);

    await patchProject(ada, project.id, {
      description: 'Selects one of two inputs.'
    });
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(4);
    expect((await translation(project.link, 'de')).json().description).toBe(
      'DE Selects one of two inputs.'
    );
  });

  it('counts no attempt for a transient failure, and backs the loop off', async () => {
    const project = await createProject(ada, { name: 'Shift Register' });
    fake.answer(project.id, () => ({
      kind: 'transient',
      reason: 'OpenRouter answered 429',
      retryAfterSeconds: 120,
      calls: [],
      rejections: []
    }));

    await worker.tick();

    const released = await row(project.id);
    expect(released.translationAttempts).toBe(0);
    expect(released.translationClaimedAt).toBeNull();

    // Within the server's Retry-After nothing is claimed.
    await worker.tick();
    expect(fake.callsFor(project.id)).toHaveLength(1);
    expect((await row(project.id)).translationClaimedAt).toBeNull();

    worker.advance(121_000);
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(2);
    expect((await detail(project.link, 'de')).json().machineTranslation).toBe(
      true
    );
  });

  it('settles languageless and fully authored texts without a call', async () => {
    const languageless = await createProject(ada, {
      name: '7400',
      description: ''
    });
    const authored = await createProject(ada, { name: 'Adder' });
    const almost = await createProject(ada, { name: 'Subtractor' });
    for (const lang of ['en', 'de', 'fr', 'es']) {
      const texts = { name: `Adder ${lang}`, description: `Adds (${lang}).` };
      for (const project of lang === 'es' ? [authored] : [authored, almost]) {
        const put = await api.inject({
          method: 'PUT',
          url: `/api/projects/${project.id}/texts/${lang}`,
          headers: ada.headers(),
          payload: texts
        });
        expect(put.statusCode).toBe(200);
      }
    }

    await worker.tick();

    expect(fake.callsFor(languageless.id)).toEqual([]);
    expect((await detail(languageless.link, 'de')).json()).toMatchObject({
      textLanguage: { name: 'zxx', description: 'zxx' },
      machineTranslation: false
    });

    expect(fake.callsFor(authored.id)).toEqual([]);
    const settled = await row(authored.id);
    expect(settled.translatedDigest).toBe(settled.textDigest);
    expect(settled.nameLanguage).toBeNull();
    expect(settled.descriptionLanguage).toBeNull();

    // One site language without its author's version still needs the model.
    expect(fake.callsFor(almost.id)).toHaveLength(1);
  });

  it('translates what its authors uncover once it was settled by them', async () => {
    const project = await createProject(ada, { name: 'Half Adder' });
    const putVersion = (lang: string, payload: Record<string, string>) =>
      api.inject({
        method: 'PUT',
        url: `/api/projects/${project.id}/texts/${lang}`,
        headers: ada.headers(),
        payload
      });
    for (const lang of ['en', 'de', 'fr', 'es']) {
      const texts = { name: `Adder ${lang}`, description: `Adds (${lang}).` };
      expect((await putVersion(lang, texts)).statusCode).toBe(200);
    }
    await worker.tick();
    expect(fake.callsFor(project.id)).toEqual([]);

    // Rewritten whole, every language still covered: settled again, no call.
    await putVersion('fr', { name: 'Demi', description: 'Additionne.' });
    expect((await row(project.id)).translatedDigest).toBeNull();
    await worker.tick();
    expect(fake.callsFor(project.id)).toEqual([]);
    expect((await row(project.id)).translatedDigest).not.toBeNull();

    const removed = await api.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}/texts/de`,
      headers: ada.headers()
    });
    expect(removed.statusCode).toBe(200);
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      description: 'Adds three bits.',
      textLanguage: { description: 'en' },
      machineTranslation: true
    });
  });

  it('renews a batch member’s lease when its call starts', async () => {
    const project = await createProject(ada, { name: 'Barrel Shifter' });
    const claimed = await claimPending(api.db, projects, {
      debounceSeconds: 0,
      batch: 100
    });
    const others = claimed.filter((claim) => claim.id !== project.id);
    for (const claim of others) await releaseClaim(api.db, projects, claim);
    const claim = claimed.find((each) => each.id === project.id)!;

    // The batch before it took the whole lease.
    const aged = await api.db.execute<{ claimed_at: string }>(sql`
      UPDATE projects
         SET translation_claimed_at = translation_claimed_at - interval '${sql.raw(String(TRANSLATION_LEASE_MINUTES))} minutes 1 second'
       WHERE id = ${project.id}
      RETURNING translation_claimed_at::text AS claimed_at
    `);
    const renewed = await renewForCall(api.db, projects, {
      ...claim,
      claimedAt: aged.rows[0].claimed_at
    });
    expect(renewed).not.toBeNull();

    // Another instance's claim passes it by while its call is in flight.
    const elsewhere = await claimPending(api.db, projects, {
      debounceSeconds: 0,
      batch: 100
    });
    for (const each of elsewhere) await releaseClaim(api.db, projects, each);
    expect(elsewhere.map((each) => each.id)).not.toContain(project.id);
    await releaseClaim(api.db, projects, renewed!);
  });

  it('pauses on a spent budget until the key has budget again', async () => {
    const project = await createProject(ada, { name: 'ALU' });
    const behind = await createProject(ada, { name: 'Register File' });
    fake.answer(project.id, () => ({
      kind: 'system',
      pause: 'budget',
      reason: 'OpenRouter answered 402',
      calls: [],
      rejections: []
    }));

    await worker.tick();

    // The rest of the batch is let go rather than held under the pause.
    expect(fake.callsFor(behind.id)).toEqual([]);
    for (const id of [project.id, behind.id]) {
      const released = await row(id);
      expect(released.translationClaimedAt).toBeNull();
      expect(released.translationAttempts).toBe(0);
    }

    fake.budget = { kind: 'exhausted', remainingUsd: 0 };
    const reads = fake.budgetReads;
    await worker.tick();
    expect(fake.budgetReads).toBe(reads);

    worker.advance(30 * 60_000);
    await worker.tick();
    expect(fake.budgetReads).toBe(reads + 1);
    expect(fake.callsFor(project.id)).toHaveLength(1);

    fake.budget = { kind: 'available', remainingUsd: 1 };
    worker.advance(30 * 60_000);
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(2);
    expect(fake.callsFor(behind.id)).toHaveLength(1);
  });

  it('claims nothing while the key reports its budget spent', async () => {
    fake.budget = { kind: 'exhausted', remainingUsd: 0.01 };
    const project = await createProject(ada, { name: 'Clock Divider' });

    await worker.tick();

    expect(fake.callsFor(project.id)).toEqual([]);
    expect((await row(project.id)).translationClaimedAt).toBeNull();

    fake.budget = { kind: 'available', remainingUsd: 1 };
    worker.advance(30 * 60_000);
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
  });

  it('retries one call an hour while the configuration is broken, on the next document', async () => {
    const refused = await createProject(ada, { name: 'Comparator' });
    const behind = await createProject(ada, { name: 'Encoder' });
    const last = await createProject(ada, { name: 'Priority Encoder' });
    const configuration: Answer = () => ({
      kind: 'system',
      pause: 'configuration',
      reason: 'OpenRouter answered 400',
      calls: [],
      rejections: []
    });
    fake.answer(refused.id, configuration);
    fake.answer(behind.id, configuration);

    await worker.tick();
    worker.advance(59 * 60_000);
    await worker.tick();

    expect(fake.callsFor(refused.id)).toHaveLength(1);
    expect(fake.callsFor(behind.id)).toEqual([]);

    worker.advance(60_000);
    await worker.tick();
    expect(fake.callsFor(behind.id)).toHaveLength(1);
    expect(fake.callsFor(last.id)).toEqual([]);

    // A request refused for itself does not hold up the queue.
    worker.advance(60 * 60_000);
    await worker.tick();
    expect(fake.callsFor(last.id)).toHaveLength(1);
    expect(fake.callsFor(refused.id)).toHaveLength(1);
    expect(fake.callsFor(behind.id)).toHaveLength(1);
    for (const id of [refused.id, behind.id]) {
      const held = await row(id);
      expect(held.translationAttempts).toBe(0);
      expect(held.translationClaimedAt!.getTime()).toBeGreaterThan(Date.now());
    }
  });

  // Last in this application: a refusal turns the check off for its lifetime.
  it('stops asking a key endpoint that refuses the key', async () => {
    fake.budget = { kind: 'refused', status: 401 };
    const first = await createProject(ada, { name: 'Latch' });

    await worker.tick();
    expect(fake.callsFor(first.id)).toHaveLength(1);
    const reads = fake.budgetReads;

    const second = await createProject(ada, { name: 'Flip Flop' });
    await worker.tick();

    expect(fake.callsFor(second.id)).toHaveLength(1);
    expect(fake.budgetReads).toBe(reads);
  });
});

describe('the per-owner daily limit', () => {
  let api: E2eApp;
  const fake = new FakeTranslator();
  const { signUp, createProject, row } = fixture(() => api);

  beforeAll(async () => {
    api = await startE2eApp(
      { TRANSLATION_DAILY_LIMIT_PER_USER: '2' },
      { translator: fake }
    );
  });

  afterAll(async () => {
    await api.close();
  });

  it('holds an owner’s documents past the limit until the next UTC day', async () => {
    const ada = await signUp('ada@example.com', 'Ada');
    const grace = await signUp('grace@example.com', 'Grace');
    const adas = [];
    for (const name of ['Adder', 'Counter', 'Decoder']) {
      adas.push(await createProject(ada, { name }));
    }
    const graces = await createProject(grace, { name: 'Encoder' });

    await driverOf(api).tick();

    const sent = adas.filter((project) => fake.callsFor(project.id).length > 0);
    expect(sent).toHaveLength(2);
    // The limit is per owner: another member's document is not held by it.
    expect(fake.callsFor(graces.id)).toHaveLength(1);

    const [held] = adas.filter((project) => !sent.includes(project));
    const stored = await row(held.id);
    expect(stored.translationAttempts).toBe(0);
    expect(stored.translationClaimedAt).not.toBeNull();
    expect(
      stored.translationClaimedAt!.getTime() +
        TRANSLATION_LEASE_MINUTES * 60_000
    ).toBe(startOfNextUtcDay(Date.now()));

    await driverOf(api).tick();
    expect(fake.callsFor(held.id)).toEqual([]);
  });
});

describe('with translation switched off', () => {
  let api: E2eApp;
  const fake = new FakeTranslator();
  const { signUp, createProject, row, detail, translation } = fixture(
    () => api
  );

  beforeAll(async () => {
    // A poll period short enough that a registered worker would have run.
    api = await startE2eApp(
      { TRANSLATION_ENABLED: 'false', TRANSLATION_POLL_SECONDS: '1' },
      { translator: fake }
    );
  });

  afterAll(async () => {
    await api.close();
  });

  it('claims nothing, and still serves what was translated before', async () => {
    const ada = await signUp('ada@example.com', 'Ada');
    const pending = await createProject(ada, { name: 'Counter' });
    const before = await createProject(ada, { name: 'Adder' });
    // What the worker wrote while it still ran.
    const { textDigest } = await row(before.id);
    expect(
      await settleTranslation(
        api.db,
        projects,
        { id: before.id, textDigest },
        {
          nameLanguage: 'en',
          descriptionLanguage: 'en',
          texts: { de: { name: null, description: 'Addiert drei Bits.' } },
          model: SERVED_MODEL
        }
      )
    ).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1_500));

    expect(api.translation).toBeNull();
    expect(api.app.get(SchedulerRegistry).getIntervals()).toEqual([]);
    expect(fake.calls).toEqual([]);
    const untouched = await row(pending.id);
    expect(untouched.translationClaimedAt).toBeNull();
    expect(untouched.translatedDigest).toBeNull();
    expect((await detail(pending.link, 'de')).json()).toMatchObject({
      machineTranslation: false
    });

    expect((await detail(before.link, 'de')).json()).toMatchObject({
      machineTranslation: true
    });
    const served = await translation(before.link, 'de');
    expect(served.statusCode).toBe(200);
    expect(served.json().description).toBe('Addiert drei Bits.');
  });
});
