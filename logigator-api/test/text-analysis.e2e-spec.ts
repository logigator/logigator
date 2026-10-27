import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { SchedulerRegistry } from '@nestjs/schedule';
import type {
  OwnedProjectSummary,
  Page,
  ProjectSummary,
  WrittenComponentSummary,
  WrittenProjectSummary
} from '@logigator/contract';
import {
  documentReports,
  projectTexts,
  projects
} from '../src/database/schema';
import { MachineModerationService } from '../src/moderation/machine-moderation.service';
import { ModerationService } from '../src/moderation/moderation.service';
import type { ModerationVerdict } from '../src/moderation/moderation-verdict';
import {
  ANALYSIS_LEASE_MINUTES,
  startOfNextUtcDay
} from '../src/text-analysis/analysis-lease';
import {
  claimPending,
  releaseClaim,
  renewForCall,
  settleAnalysis
} from '../src/text-analysis/analysis-queries';
import type {
  AnalysisInput,
  AnalysisOutcome,
  CallUsage,
  KeyBudget,
  TextAnalyzer
} from '../src/text-analysis/text-analyzer';
import { circuitDocument, EMPTY_BODY, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp, type TextAnalysisDriver } from './harness';

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

/** A reply's verdict on a text that breaks no rule. */
const HARMLESS: ModerationVerdict = {
  category: 'none',
  certain: true,
  note: ''
};

/**
 * What the fake answers by default: an English original, translated and
 * judged harmless.
 */
function translated(input: AnalysisInput): AnalysisOutcome {
  return {
    kind: 'success',
    model: SERVED_MODEL,
    calls: [USAGE],
    verdict: HARMLESS,
    verdictCall: USAGE,
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
  input: AnalysisInput
) => AnalysisOutcome | Promise<AnalysisOutcome>;

const documentFailure: Answer = () => ({
  kind: 'document',
  reason: 'the reply was refused twice',
  calls: [USAGE, USAGE],
  verdict: null,
  verdictCall: null
});

/**
 * Stands in for OpenRouter. It answers {@link translated} unless a spec has
 * queued answers for a document, and records every call it is asked to make.
 */
class FakeAnalyzer implements TextAnalyzer {
  readonly calls: { documentId: string; input: AnalysisInput }[] = [];
  budget: KeyBudget = { kind: 'available', remainingUsd: 1 };
  budgetReads = 0;
  private readonly queued = new Map<string, Answer[]>();

  answer(documentId: string, ...answers: Answer[]): void {
    this.queued.set(documentId, [
      ...(this.queued.get(documentId) ?? []),
      ...answers
    ]);
  }

  callsFor(documentId: string): AnalysisInput[] {
    return this.calls
      .filter((call) => call.documentId === documentId)
      .map((call) => call.input);
  }

  async analyze(
    input: AnalysisInput,
    documentId: string
  ): Promise<AnalysisOutcome> {
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
  ): Promise<WrittenProjectSummary> {
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
  ): Promise<WrittenProjectSummary> {
    const response = await api().inject({
      method: 'PATCH',
      url: `/api/projects/${id}`,
      headers: { ...cookies.headers(), ...headers },
      payload
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  /** Writes the author's version in one language. */
  async function putText(
    cookies: CookieJar,
    id: string,
    lang: string,
    payload: Record<string, string>
  ): Promise<void> {
    const response = await api().inject({
      method: 'PUT',
      url: `/api/projects/${id}/texts/${lang}`,
      headers: cookies.headers(),
      payload
    });
    expect(response.statusCode).toBe(200);
  }

  async function deleteText(
    cookies: CookieJar,
    id: string,
    lang: string
  ): Promise<void> {
    const response = await api().inject({
      method: 'DELETE',
      url: `/api/projects/${id}/texts/${lang}`,
      headers: cookies.headers()
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

  /**
   * Whether a stranger comes across the project in the browse search and on
   * its author's profile, the listings the sitemap is walked from too.
   */
  async function advertised(project: ProjectSummary): Promise<boolean[]> {
    const { userId } = await row(project.id);
    const listings = [
      `/api/community/projects?search=${encodeURIComponent(project.name)}&size=100`,
      `/api/community/users/${userId}/projects?size=100`
    ];
    return Promise.all(
      listings.map(async (url) => {
        const response = await api().inject({ method: 'GET', url });
        expect(response.statusCode).toBe(200);
        return (response.json() as Page<ProjectSummary>).entries.some(
          (entry) => entry.id === project.id
        );
      })
    );
  }

  /** The owner's shelf entry for the project. */
  async function owned(
    cookies: CookieJar,
    project: ProjectSummary
  ): Promise<OwnedProjectSummary | undefined> {
    const response = await api().inject({
      method: 'GET',
      url: `/api/projects?size=100&search=${encodeURIComponent(project.name)}`,
      headers: cookies.headers()
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as Page<OwnedProjectSummary>).entries.find(
      (entry) => entry.id === project.id
    );
  }

  return {
    signUp,
    createProject,
    patchProject,
    putText,
    deleteText,
    row,
    machineRows,
    detail,
    translation,
    advertised,
    owned
  };
}

function driverOf(api: E2eApp): TextAnalysisDriver {
  if (!api.textAnalysis) throw new Error('The worker is not registered.');
  return api.textAnalysis;
}

describe('the text analysis worker', () => {
  let api: E2eApp;
  let worker: TextAnalysisDriver;
  const fake = new FakeAnalyzer();
  const {
    signUp,
    createProject,
    patchProject,
    putText,
    deleteText,
    row,
    machineRows,
    detail,
    translation,
    advertised,
    owned
  } = fixture(() => api);
  let ada: CookieJar;
  /** A member of their own, so the checks count against nobody's daily limit. */
  let lin: CookieJar;

  beforeAll(async () => {
    api = await startE2eApp({}, { analyzer: fake });
    worker = driverOf(api);
    ada = await signUp('ada@example.com', 'Ada');
    lin = await signUp('lin@example.com', 'Lin');
  });

  afterAll(async () => {
    await api.close();
  });

  it('is scheduled, where the switched-off application has no interval', () => {
    expect(api.app.get(SchedulerRegistry).getIntervals()).toEqual([
      'text-analysis-worker'
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
      {
        name: 'Full Adder',
        description: 'Adds three bits.',
        hint: 'de',
        versions: []
      }
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
    expect(stored.analyzedDigest).toBe(stored.textDigest);
    expect(stored.analysisClaimedAt).toBeNull();
    for (const machine of await machineRows(project.id)) {
      expect(machine.sourceDigest).toBe(stored.textDigest);
      expect(machine.model).toBe(SERVED_MODEL);
    }
  });

  it('lists a published document only once its text is checked', async () => {
    const project = await createProject(lin, { name: 'Awaited Adder' });

    // Its link works for anybody all along; it is only not advertised.
    const before = await detail(project.link, 'en');
    expect(before.statusCode).toBe(200);
    expect(before.json().awaitingCheck).toBe(true);
    expect((await owned(lin, project))?.awaitingCheck).toBe(true);
    expect(await advertised(project)).toEqual([false, false]);

    await worker.tick();

    expect((await detail(project.link, 'en')).json().awaitingCheck).toBe(false);
    expect((await owned(lin, project))?.awaitingCheck).toBe(false);
    expect(await advertised(project)).toEqual([true, true]);
  });

  it('answers its owner’s create and edits with the check they leave it waiting for', async () => {
    const project = await createProject(lin, { name: 'Answered Adder' });
    expect(project).toMatchObject({ awaitingCheck: true, hidden: null });

    const component = await api.inject({
      method: 'POST',
      url: '/api/components',
      headers: lin.headers(),
      payload: {
        name: 'Answered Part',
        symbol: 'AP',
        description: 'Adds three bits.',
        visibility: 'public',
        document: circuitDocument('Answered Part', HALF_ADDER_BODY)
      }
    });
    expect(component.statusCode).toBe(201);
    expect(component.json<WrittenComponentSummary>()).toMatchObject({
      awaitingCheck: true,
      hidden: null
    });

    await worker.tick();

    // A visibility change leaves the checked text as it is; a rename does not.
    const republished = await patchProject(lin, project.id, {
      visibility: 'public'
    });
    expect(republished.awaitingCheck).toBe(false);
    expect(republished.awaitingCheck).toBe(
      (await owned(lin, project))?.awaitingCheck
    );

    const renamed = await patchProject(lin, project.id, {
      name: 'Answered Adder 2'
    });
    expect(renamed.awaitingCheck).toBe(true);
    expect(renamed.awaitingCheck).toBe(
      (await owned(lin, renamed))?.awaitingCheck
    );
  });

  it('takes an edited text out of the listings until it is checked again', async () => {
    const project = await createProject(lin, { name: 'Edited Adder' });
    await worker.tick();
    expect(await advertised(project)).toEqual([true, true]);

    // A board edit leaves the text, and the check, as they are.
    const saved = await api.inject({
      method: 'PUT',
      url: `/api/projects/${project.id}`,
      headers: lin.headers(),
      payload: {
        version: project.version,
        document: circuitDocument('Edited Adder', HALF_ADDER_BODY)
      }
    });
    expect(saved.statusCode).toBe(200);
    expect(await advertised(project)).toEqual([true, true]);

    await patchProject(lin, project.id, { description: 'Adds, then some.' });
    expect(await advertised(project)).toEqual([false, false]);
    expect((await detail(project.link, 'en')).json().awaitingCheck).toBe(true);

    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(2);
    expect(await advertised(project)).toEqual([true, true]);
  });

  it('takes a document out of the listings when its author writes a version', async () => {
    const project = await createProject(lin, { name: 'Versioned Adder' });
    await worker.tick();
    expect(await advertised(project)).toEqual([true, true]);

    await putText(lin, project.id, 'de', { name: 'Addierer' });

    expect(await advertised(project)).toEqual([false, false]);
    expect((await owned(lin, project))?.awaitingCheck).toBe(true);

    await worker.tick();

    expect(fake.callsFor(project.id).at(-1)?.versions).toEqual([
      { language: 'de', name: 'Addierer', description: null }
    ]);
    expect(await advertised(project)).toEqual([true, true]);
  });

  it('checks a text by the verdict of a refused translation', async () => {
    const project = await createProject(lin, { name: 'Refused Adder' });
    fake.answer(project.id, () => ({
      kind: 'document',
      reason: 'the description was refused twice',
      calls: [USAGE, USAGE],
      verdict: HARMLESS,
      verdictCall: USAGE
    }));

    await worker.tick();

    const failed = await row(project.id);
    expect(failed.analysisAttempts).toBe(1);
    expect(failed.analyzedDigest).toBeNull();
    expect(await advertised(project)).toEqual([true, true]);
  });

  it('reports a text no call gave a verdict for, and lists it once the report is resolved', async () => {
    const project = await createProject(lin, { name: 'Unjudged Adder' });
    fake.answer(project.id, documentFailure, documentFailure, documentFailure);

    for (let tick = 0; tick < 3; tick++) await worker.tick();

    const parked = await row(project.id);
    const reports = await api.db
      .select()
      .from(documentReports)
      .where(eq(documentReports.documentId, project.id));
    expect(reports).toMatchObject([
      {
        source: 'machine',
        reason: 'other',
        textDigest: parked.textDigest,
        resolvedAt: null
      }
    ]);
    expect(reports[0]!.explanation).toContain(
      'No verdict could be obtained after 3 attempts.'
    );
    expect(await advertised(project)).toEqual([false, false]);

    expect(
      await api.app
        .get(ModerationService)
        .resolve(reports[0]!.id, 'Read it; harmless.')
    ).toBe('resolved');

    expect(await advertised(project)).toEqual([true, true]);
    expect((await detail(project.link, 'en')).json().awaitingCheck).toBe(false);
  });

  it('opens no report for a parked text an earlier attempt already judged', async () => {
    const project = await createProject(lin, { name: 'Judged Adder' });
    fake.answer(
      project.id,
      () => ({
        kind: 'document',
        reason: 'the reply was cut short',
        calls: [USAGE],
        verdict: HARMLESS,
        verdictCall: USAGE
      }),
      documentFailure,
      documentFailure
    );

    for (let tick = 0; tick < 3; tick++) await worker.tick();

    expect((await row(project.id)).analysisAttempts).toBe(3);
    expect(
      await api.db
        .select()
        .from(documentReports)
        .where(eq(documentReports.documentId, project.id))
    ).toEqual([]);
    expect(await advertised(project)).toEqual([true, true]);
  });

  it('takes a parked text again once its author writes a version', async () => {
    const project = await createProject(lin, { name: 'Parked Adder' });
    fake.answer(
      project.id,
      () => ({
        kind: 'document',
        reason: 'the reply was cut short',
        calls: [USAGE],
        verdict: HARMLESS,
        verdictCall: USAGE
      }),
      documentFailure,
      documentFailure
    );
    for (let tick = 0; tick < 3; tick++) await worker.tick();

    await putText(lin, project.id, 'de', { name: 'Addierer' });
    expect(await advertised(project)).toEqual([false, false]);

    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(4);
    expect(await advertised(project)).toEqual([true, true]);
  });

  it('judges a version written after a moderator cleared the text', async () => {
    const project = await createProject(lin, { name: 'Cleared Adder' });
    fake.answer(project.id, documentFailure, documentFailure, documentFailure);
    for (let tick = 0; tick < 3; tick++) await worker.tick();
    const [unjudged] = await api.db
      .select()
      .from(documentReports)
      .where(eq(documentReports.documentId, project.id));
    await api.app
      .get(ModerationService)
      .resolve(unjudged!.id, 'Read it; harmless.');
    expect(await advertised(project)).toEqual([true, true]);

    await putText(lin, project.id, 'de', { name: 'Werbung' });
    expect(await advertised(project)).toEqual([false, false]);

    fake.answer(project.id, (input) => ({
      ...translated(input),
      verdict: { category: 'spam', certain: false, note: 'An ad.' },
      verdictCall: USAGE
    }));
    await worker.tick();

    expect(
      await api.db
        .select()
        .from(documentReports)
        .where(
          and(
            eq(documentReports.documentId, project.id),
            isNull(documentReports.resolvedAt)
          )
        )
    ).toMatchObject([{ source: 'machine', reason: 'spam' }]);
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
    expect(stored.analyzedDigest).not.toBe(stored.textDigest);
    // Released at once, so the new text is not held up by the old claim.
    expect(stored.analysisClaimedAt).toBeNull();
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
    expect((await row(project.id)).analysisClaimedAt).toBeNull();

    await patchProject(ada, project.id, { visibility: 'unlisted' });
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
    // An unlisted document resolves for whoever holds the link.
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      machineTranslation: true
    });
  });

  it('passes an unlisted empty board by until something is drawn on it', async () => {
    const project = await createProject(ada, {
      visibility: 'unlisted',
      document: circuitDocument('Blank board', EMPTY_BODY)
    });

    await worker.tick();

    expect(fake.callsFor(project.id)).toEqual([]);
    expect((await row(project.id)).analyzedDigest).toBeNull();

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

  it('sends a public empty board, whose text anybody can read', async () => {
    const project = await createProject(ada, {
      name: 'Blank public',
      document: circuitDocument('Blank public', EMPTY_BODY)
    });

    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(1);
    const settled = await row(project.id);
    expect(settled.analyzedDigest).toBe(settled.textDigest);
  });

  it('hands moderation the verdict of a refused translation, then counts the failure', async () => {
    const apply = vi
      .spyOn(api.app.get(MachineModerationService), 'apply')
      .mockResolvedValue('reported');
    try {
      const project = await createProject(ada, { name: 'Flagged' });
      const verdict: ModerationVerdict = {
        category: 'harassment',
        certain: true,
        note: 'Threatens a named person.'
      };
      fake.answer(project.id, () => ({
        kind: 'document',
        reason: 'the description was refused twice',
        calls: [USAGE, USAGE],
        verdict,
        verdictCall: USAGE
      }));

      await worker.tick();

      const failed = await row(project.id);
      expect(apply).toHaveBeenCalledExactlyOnceWith({
        kind: 'project',
        documentId: project.id,
        textDigest: failed.textDigest,
        verdict,
        call: USAGE
      });
      expect(failed.analysisAttempts).toBe(1);
    } finally {
      apply.mockRestore();
    }
  });

  it('settles a translation whose moderation failed', async () => {
    const apply = vi
      .spyOn(api.app.get(MachineModerationService), 'apply')
      .mockRejectedValue(new Error('the report could not be written'));
    try {
      const project = await createProject(ada, { name: 'Unlucky' });
      fake.answer(project.id, (input) => ({
        ...translated(input),
        verdict: { category: 'spam', certain: false, note: 'An ad.' },
        verdictCall: USAGE
      }));

      await worker.tick();

      // Other documents still pending are judged in the same tick.
      expect(
        apply.mock.calls.filter(([input]) => input.documentId === project.id)
      ).toHaveLength(1);
      const settled = await row(project.id);
      expect(settled.analyzedDigest).toBe(settled.textDigest);
      expect(fake.callsFor(project.id)).toHaveLength(1);
    } finally {
      apply.mockRestore();
    }
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
    expect(held.analysisClaimedAt).toBeNull();
    expect(held.analyzedDigest).toBeNull();
    expect(held.analysisAttempts).toBe(0);
  });

  it('parks a text after three document failures, until it is edited', async () => {
    const project = await createProject(ada, { name: 'Multiplexer' });
    fake.answer(project.id, documentFailure, documentFailure, documentFailure);

    for (let tick = 0; tick < 3; tick++) await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(3);
    const parked = await row(project.id);
    expect(parked.analysisAttempts).toBe(3);
    expect(parked.analysisAttemptDigest).toBe(parked.textDigest);
    expect(parked.analysisClaimedAt).toBeNull();

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
      verdict: null,
      verdictCall: null
    }));

    await worker.tick();

    const released = await row(project.id);
    expect(released.analysisAttempts).toBe(0);
    expect(released.analysisClaimedAt).toBeNull();

    // Within the server's Retry-After nothing is claimed.
    await worker.tick();
    expect(fake.callsFor(project.id)).toHaveLength(1);
    expect((await row(project.id)).analysisClaimedAt).toBeNull();

    worker.advance(121_000);
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(2);
    expect((await detail(project.link, 'de')).json().machineTranslation).toBe(
      true
    );
  });

  it('sends a languageless name and a fully authored document like any other', async () => {
    const languageless = await createProject(ada, {
      name: '7400',
      description: ''
    });
    const authored = await createProject(ada, { name: 'Adder' });
    const versions = ['de', 'en', 'es', 'fr'].map((language) => ({
      language,
      name: `Adder ${language}`,
      description: `Adds (${language}).`
    }));
    for (const { language, ...texts } of versions) {
      await putText(ada, authored.id, language, texts);
    }

    await worker.tick();

    expect(fake.callsFor(languageless.id)).toMatchObject([
      { name: '7400', description: '', versions: [] }
    ]);
    // Every version is shown to some reader, so every one is judged.
    expect(fake.callsFor(authored.id)).toMatchObject([
      { name: 'Adder', description: 'Adds three bits.', versions }
    ]);
    const settled = await row(authored.id);
    expect(settled.analyzedDigest).toBe(settled.textDigest);
    expect(settled.nameLanguage).toBe('en');
  });

  it('judges a document again when its author writes or removes a version', async () => {
    const project = await createProject(ada, { name: 'Half Adder' });
    await worker.tick();
    expect(fake.callsFor(project.id)).toHaveLength(1);

    await putText(ada, project.id, 'fr', {
      name: 'Demi',
      description: 'Additionne.'
    });

    // The digest did not move, yet the document is pending again, and its
    // languages read as unknown until the new call lands.
    const pending = await row(project.id);
    expect(pending.analyzedDigest).toBeNull();
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      textLanguage: { name: null, description: null },
      machineTranslation: false
    });

    await worker.tick();
    expect(fake.callsFor(project.id).at(-1)?.versions).toEqual([
      { language: 'fr', name: 'Demi', description: 'Additionne.' }
    ]);
    expect((await detail(project.link, 'de')).json()).toMatchObject({
      textLanguage: { name: 'en', description: 'en' },
      machineTranslation: true
    });

    await deleteText(ada, project.id, 'fr');
    expect((await row(project.id)).analyzedDigest).toBeNull();
    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(3);
    expect(fake.callsFor(project.id).at(-1)?.versions).toEqual([]);
    const settled = await row(project.id);
    expect(settled.analyzedDigest).toBe(settled.textDigest);
  });

  it('judges again a document given a version while its call was in flight', async () => {
    const project = await createProject(ada, { name: 'Full Subtractor' });
    fake.answer(project.id, async (input) => {
      await putText(ada, project.id, 'de', { name: 'Subtrahierer' });
      return translated(input);
    });

    await worker.tick();

    // Not settled for versions the call never saw.
    const pending = await row(project.id);
    expect(pending.analyzedDigest).toBeNull();
    expect(pending.analysisClaimedAt).toBeNull();

    await worker.tick();

    expect(fake.callsFor(project.id)).toHaveLength(2);
    expect(fake.callsFor(project.id)[1].versions).toEqual([
      { language: 'de', name: 'Subtrahierer', description: null }
    ]);
    const settled = await row(project.id);
    expect(settled.analyzedDigest).toBe(settled.textDigest);
  });

  it('waits out the debounce after a version as after an edit', async () => {
    const project = await createProject(ada, { name: 'Ring Counter' });
    await worker.tick();
    await api.db
      .update(projects)
      .set({ lastEditedAt: sql`now() - interval '2 hours'` })
      .where(eq(projects.id, project.id));
    await putText(ada, project.id, 'es', { name: 'Contador en anillo' });

    const claimedIds = async () => {
      const claimed = await claimPending(api.db, projects, {
        debounceSeconds: 60 * 60,
        batch: 100
      });
      for (const claim of claimed) await releaseClaim(api.db, projects, claim);
      return claimed.map((claim) => claim.id);
    };

    expect(await claimedIds()).not.toContain(project.id);

    await api.db
      .update(projectTexts)
      .set({ createdAt: sql`now() - interval '2 hours'` })
      .where(eq(projectTexts.documentId, project.id));
    expect(await claimedIds()).toContain(project.id);
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
         SET analysis_claimed_at = analysis_claimed_at - interval '${sql.raw(String(ANALYSIS_LEASE_MINUTES))} minutes 1 second'
       WHERE id = ${project.id}
      RETURNING analysis_claimed_at::text AS claimed_at
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
      verdict: null,
      verdictCall: null
    }));

    await worker.tick();

    // The rest of the batch is let go rather than held under the pause.
    expect(fake.callsFor(behind.id)).toEqual([]);
    for (const id of [project.id, behind.id]) {
      const released = await row(id);
      expect(released.analysisClaimedAt).toBeNull();
      expect(released.analysisAttempts).toBe(0);
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

  it('analyzes nothing while the key reports its budget spent', async () => {
    fake.budget = { kind: 'exhausted', remainingUsd: 0.01 };
    const project = await createProject(ada, { name: 'Clock Divider' });

    await worker.tick();

    expect(fake.callsFor(project.id)).toEqual([]);
    expect((await row(project.id)).analysisClaimedAt).toBeNull();

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
      verdict: null,
      verdictCall: null
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
      expect(held.analysisAttempts).toBe(0);
      expect(held.analysisClaimedAt!.getTime()).toBeGreaterThan(Date.now());
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
  const fake = new FakeAnalyzer();
  const { signUp, createProject, row } = fixture(() => api);

  beforeAll(async () => {
    api = await startE2eApp(
      { TEXT_ANALYSIS_DAILY_LIMIT_PER_USER: '2' },
      { analyzer: fake }
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
    expect(stored.analysisAttempts).toBe(0);
    expect(stored.analysisClaimedAt).not.toBeNull();
    expect(
      stored.analysisClaimedAt!.getTime() + ANALYSIS_LEASE_MINUTES * 60_000
    ).toBe(startOfNextUtcDay(Date.now()));

    await driverOf(api).tick();
    expect(fake.callsFor(held.id)).toEqual([]);
  });
});

describe('with text analysis switched off', () => {
  let api: E2eApp;
  const fake = new FakeAnalyzer();
  const { signUp, createProject, row, detail, translation, advertised } =
    fixture(() => api);

  beforeAll(async () => {
    // A poll period short enough that a registered worker would have run.
    api = await startE2eApp(
      { TEXT_ANALYSIS_ENABLED: 'false', TEXT_ANALYSIS_POLL_SECONDS: '1' },
      { analyzer: fake }
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
    const claimed = await claimPending(api.db, projects, {
      debounceSeconds: 0,
      batch: 100
    });
    for (const other of claimed.filter((each) => each.id !== before.id)) {
      await releaseClaim(api.db, projects, other);
    }
    expect(
      await settleAnalysis(
        api.db,
        projects,
        claimed.find((each) => each.id === before.id)!,
        {
          nameLanguage: 'en',
          descriptionLanguage: 'en',
          texts: { de: { name: null, description: 'Addiert drei Bits.' } }
        },
        SERVED_MODEL
      )
    ).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1_500));

    expect(api.textAnalysis).toBeNull();
    expect(api.app.get(SchedulerRegistry).getIntervals()).toEqual([]);
    expect(fake.calls).toEqual([]);
    const untouched = await row(pending.id);
    expect(untouched.analysisClaimedAt).toBeNull();
    expect(untouched.analyzedDigest).toBeNull();
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

  it('lists a published document at once, with no check to wait for', async () => {
    const grace = await signUp('grace@example.com', 'Grace');
    const project = await createProject(grace, { name: 'Unchecked Adder' });

    expect(project.awaitingCheck).toBe(false);
    expect((await detail(project.link, 'en')).json().awaitingCheck).toBe(false);
    expect(await advertised(project)).toEqual([true, true]);
  });
});
