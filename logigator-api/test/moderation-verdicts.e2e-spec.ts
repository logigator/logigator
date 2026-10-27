import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProjectSummary } from '@logigator/contract';
import { and, eq } from 'drizzle-orm';
import { documentReports, projects } from '../src/database/schema';
import {
  type MachineVerdictInput,
  MachineModerationService,
  type VerdictCall
} from '../src/moderation/machine-moderation.service';
import { ModerationService } from '../src/moderation/moderation.service';
import type { ModerationVerdict } from '../src/moderation/moderation-verdict';
import { circuitDocument, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

const OPERATOR = 'ops@logigator.test';
const OWNER = 'ada@example.com';

const CALL: VerdictCall = {
  model: 'openai/gpt-e2e',
  generationId: 'gen-e2e-1'
};

const SEVERE: ModerationVerdict = {
  category: 'harassment',
  certain: true,
  note: 'Threatens a named classmate.'
};

/** A user signed up, verified and signed in, as the moderation spec does it. */
async function signUp(
  api: E2eApp,
  email: string,
  username: string
): Promise<CookieJar> {
  const password = 'lovelace1';
  expect(
    (
      await api.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username, email, password }
      })
    ).statusCode
  ).toBe(201);
  await api.inject({
    method: 'POST',
    url: '/api/auth/verify-email',
    payload: { token: api.mail.lastToken() }
  });

  const cookies = new CookieJar();
  cookies.store(
    await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password }
    })
  );
  return cookies;
}

/** A public project, written in `language` as far as the API can tell. */
async function publicProject(
  api: E2eApp,
  owner: CookieJar,
  name: string,
  language = 'en'
): Promise<ProjectSummary> {
  const response = await api.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { ...owner.headers(), 'accept-language': language },
    payload: {
      name,
      visibility: 'public',
      document: circuitDocument(name, HALF_ADDER_BODY)
    }
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function textDigest(api: E2eApp, id: string): Promise<string> {
  const [row] = await api.db
    .select({ textDigest: projects.textDigest })
    .from(projects)
    .where(eq(projects.id, id));
  return row!.textDigest;
}

async function machineReports(api: E2eApp, id: string) {
  return api.db
    .select()
    .from(documentReports)
    .where(
      and(
        eq(documentReports.documentId, id),
        eq(documentReports.source, 'machine')
      )
    );
}

describe('machine moderation verdicts', () => {
  let api: E2eApp;
  let machine: MachineModerationService;
  let moderation: ModerationService;
  let ada: CookieJar;

  /** The verdict as the worker hands it over, for the project's current text. */
  async function verdictFor(
    project: ProjectSummary,
    verdict: ModerationVerdict
  ): Promise<MachineVerdictInput> {
    return {
      kind: 'project',
      documentId: project.id,
      textDigest: await textDigest(api, project.id),
      verdict,
      call: CALL
    };
  }

  const communityPage = (link: string, cookies?: CookieJar) =>
    api.inject({
      method: 'GET',
      url: `/api/community/projects/${link}`,
      headers: cookies?.headers() ?? {}
    });

  const rename = (project: ProjectSummary, name: string) =>
    api.inject({
      method: 'PATCH',
      url: `/api/projects/${project.id}`,
      headers: ada.headers(),
      payload: { name }
    });

  const mailTo = (address: string) =>
    api.mail.sent.filter((mail) => mail.to === address);

  beforeAll(async () => {
    api = await startE2eApp({
      REPORT_MAIL_TO: OPERATOR,
      MODERATION_AUTO_HIDE: 'true'
    });
    machine = api.app.get(MachineModerationService);
    moderation = api.app.get(ModerationService);
    ada = await signUp(api, OWNER, 'Ada');
  });

  afterAll(async () => {
    await api.close();
  });

  it('hides on a certain severe verdict, reports it and mails the operator and the owner', async () => {
    const project = await publicProject(api, ada, 'Threat board');
    api.mail.clear();

    expect(await machine.apply(await verdictFor(project, SEVERE))).toBe(
      'hidden'
    );

    expect((await communityPage(project.link)).statusCode).toBe(404);
    const own = await communityPage(project.link, ada);
    expect(own.json().hidden).toMatchObject({
      reason: '',
      automatic: true,
      category: 'harassment'
    });

    const [report, ...more] = await machineReports(api, project.id);
    expect(more).toEqual([]);
    expect(report).toMatchObject({
      reason: 'harassment',
      reporterId: null,
      contactEmail: null,
      resolvedAt: null
    });
    for (const fact of [
      CALL.model!,
      CALL.generationId!,
      'Certain: yes',
      'Hidden automatically: yes',
      SEVERE.note
    ]) {
      expect(report!.explanation).toContain(fact);
    }

    const [operator] = mailTo(OPERATOR);
    expect(operator?.subject).toBe('Hidden automatically: Threat board');
    expect(operator?.text).toContain(SEVERE.note);
    expect(operator?.text).toContain(`unhide project ${project.link}`);

    const [owner, ...again] = mailTo(OWNER);
    expect(again).toEqual([]);
    expect(owner?.text).toContain('Threat board');
    expect(owner?.text).toContain(`/en/community/projects/${project.link}`);
    expect(owner?.text).toContain('Harassment or hate');
    // The note is the model's words over the author's text: never theirs.
    expect(owner?.text).not.toContain(SEVERE.note);
    expect(owner?.html).not.toContain(SEVERE.note);
    expect(owner?.replyTo).toBe(OPERATOR);
  });

  it('mails the owner in the language the text was written in', async () => {
    const project = await publicProject(api, ada, 'Adresse', 'de');
    api.mail.clear();

    await machine.apply(
      await verdictFor(project, {
        category: 'personal_data',
        certain: true,
        note: 'Home address of a named person.'
      })
    );

    const [owner] = mailTo(OWNER);
    expect(owner?.text).toContain(`/de/community/projects/${project.link}`);
    expect(owner?.text).toContain('Personenbezogene Daten');
  });

  it.each<ModerationVerdict>([
    { category: 'harassment', certain: false, note: 'Possibly a slur.' },
    { category: 'spam', certain: true, note: 'Advertises a shop.' }
  ])(
    'only reports a $category verdict that is certain=$certain',
    async (verdict) => {
      const project = await publicProject(
        api,
        ada,
        `Flagged ${verdict.category}`
      );
      api.mail.clear();

      expect(await machine.apply(await verdictFor(project, verdict))).toBe(
        'reported'
      );

      expect((await communityPage(project.link)).statusCode).toBe(200);
      const [report] = await machineReports(api, project.id);
      expect(report?.reason).toBe(verdict.category);
      expect(report?.explanation).toContain('Hidden automatically: no');

      expect(mailTo(OWNER)).toEqual([]);
      const [operator] = mailTo(OPERATOR);
      expect(operator?.subject).toBe(
        `Document report (${verdict.category}, machine): ${project.name}`
      );
      expect(operator?.text).toContain(verdict.note);
    }
  );

  it('keeps one open machine report per document', async () => {
    const project = await publicProject(api, ada, 'Spam once');
    const spam: ModerationVerdict = {
      category: 'spam',
      certain: false,
      note: 'Link farm.'
    };

    expect(await machine.apply(await verdictFor(project, spam))).toBe(
      'reported'
    );
    expect(await machine.apply(await verdictFor(project, spam))).toBe(
      'ignored'
    );
    expect(await machine.apply(await verdictFor(project, SEVERE))).toBe(
      'hidden'
    );

    // A hide always opens a report of its own, so the verdict that hid is
    // the one a moderator reads.
    expect(
      (await machineReports(api, project.id)).map((r) => r.reason).sort()
    ).toEqual(['harassment', 'spam']);
  });

  it('ignores a verdict of none, on a text edited since, or on no document', async () => {
    const project = await publicProject(api, ada, 'Stale');
    const stale = await verdictFor(project, SEVERE);
    expect((await rename(project, 'Edited')).statusCode).toBe(200);
    api.mail.clear();

    expect(await machine.apply(stale)).toBe('ignored');
    expect(
      await machine.apply(
        await verdictFor(project, {
          category: 'none',
          certain: true,
          note: ''
        })
      )
    ).toBe('ignored');
    expect(
      await machine.apply({ ...stale, documentId: crypto.randomUUID() })
    ).toBe('ignored');

    expect((await communityPage(project.link)).statusCode).toBe(200);
    expect(await machineReports(api, project.id)).toEqual([]);
    expect(api.mail.sent).toEqual([]);
  });

  it('leaves a text a moderator unhid alone until it changes', async () => {
    const project = await publicProject(api, ada, 'Kill Switch');
    await machine.apply(await verdictFor(project, SEVERE));
    await moderation.unhide('project', project.link);
    api.mail.clear();

    // The retry of a refused translation hands over the same verdict again.
    expect(await machine.apply(await verdictFor(project, SEVERE))).toBe(
      'ignored'
    );
    expect((await communityPage(project.link)).statusCode).toBe(200);
    expect(
      (await machineReports(api, project.id)).filter((r) => !r.resolvedAt)
    ).toEqual([]);
    expect(api.mail.sent).toEqual([]);

    expect((await rename(project, 'Kill Switch 2')).statusCode).toBe(200);
    expect(await machine.apply(await verdictFor(project, SEVERE))).toBe(
      'hidden'
    );
  });

  it('leaves a text alone once a moderator resolved its machine report', async () => {
    const project = await publicProject(api, ada, 'Bomb Defusal Game');
    const mild: ModerationVerdict = {
      category: 'other',
      certain: false,
      note: 'Mentions a bomb.'
    };
    await machine.apply(await verdictFor(project, mild));
    const [report] = await machineReports(api, project.id);

    expect(await moderation.resolve(report!.id, 'A game.')).toBe('resolved');

    expect(await machine.apply(await verdictFor(project, mild))).toBe(
      'ignored'
    );
    expect(await machine.apply(await verdictFor(project, SEVERE))).toBe(
      'ignored'
    );
  });

  it('clears only the text the resolved report judged', async () => {
    const project = await publicProject(api, ada, 'Homework Help');
    const mild: ModerationVerdict = {
      category: 'spam',
      certain: false,
      note: 'An advert.'
    };
    await machine.apply(await verdictFor(project, mild));
    const [report] = await machineReports(api, project.id);

    // Edited after the report and before the moderator looked at it.
    expect((await rename(project, 'Call Tom')).statusCode).toBe(200);
    expect(await moderation.resolve(report!.id, 'Not spam.')).toBe('resolved');

    expect(await machine.apply(await verdictFor(project, SEVERE))).toBe(
      'hidden'
    );
  });

  it('keeps an automatic hide waiting for hide or unhide rather than resolve', async () => {
    const project = await publicProject(api, ada, 'Held');
    await machine.apply(await verdictFor(project, SEVERE));
    const [report] = await machineReports(api, project.id);

    expect(await moderation.resolve(report!.id, 'Looked at it.')).toBe(
      'machine-hidden'
    );
    expect((await machineReports(api, project.id))[0]?.resolvedAt).toBeNull();
    expect((await communityPage(project.link)).statusCode).toBe(404);

    await moderation.hide('project', project.link, 'Threatens a person.');
    expect(
      (await machineReports(api, project.id))[0]?.resolvedAt
    ).not.toBeNull();
  });

  it('resolves the machine’s reports on unhide, keeps readers’ open, and mails the owner', async () => {
    const project = await publicProject(api, ada, 'Reversed');
    await machine.apply(await verdictFor(project, SEVERE));
    // A hidden document takes no report over HTTP, so the reader's report is
    // written directly.
    await api.db.insert(documentReports).values({
      documentKind: 'project',
      documentId: project.id,
      reason: 'spam',
      explanation: 'From a reader.'
    });
    api.mail.clear();

    expect(await moderation.unhide('project', project.link)).toEqual({
      ownerMailed: true
    });

    const reports = await api.db
      .select()
      .from(documentReports)
      .where(eq(documentReports.documentId, project.id));
    expect(reports.map((r) => [r.source, r.resolution]).sort()).toEqual([
      ['machine', 'Unhidden by a moderator'],
      ['reader', null]
    ]);

    const [owner, ...more] = mailTo(OWNER);
    expect(more).toEqual([]);
    expect(owner?.subject).toBe('Your document is visible again');
    expect(owner?.text).toContain('Reversed');
    expect((await communityPage(project.link)).statusCode).toBe(200);

    // Nothing was hidden, so there is nothing to tell the owner.
    api.mail.clear();
    expect(await moderation.unhide('project', project.link)).toEqual({
      ownerMailed: false
    });
    expect(api.mail.sent).toEqual([]);
  });

  it('turns a machine hide into a moderator’s when a moderator hides it', async () => {
    const project = await publicProject(api, ada, 'Confirmed');
    await machine.apply(await verdictFor(project, SEVERE));
    api.mail.clear();

    expect(
      await moderation.hide('project', project.link, 'Threatens a person.')
    ).toEqual({ resolvedReports: 1, ownerMailed: true });

    expect(
      (await communityPage(project.link, ada)).json().hidden
    ).toMatchObject({
      reason: 'Threatens a person.',
      automatic: false,
      category: null
    });
    const [owner] = mailTo(OWNER);
    expect(owner?.text).toContain('Threatens a person.');
    expect(await machineReports(api, project.id)).toMatchObject([
      { resolution: 'Hidden: Threatens a person.' }
    ]);
  });

  it('lists the reports on documents the machine hid first', async () => {
    const reader = await publicProject(api, ada, 'Read first');
    await api.inject({
      method: 'POST',
      url: `/api/community/projects/${reader.link}/report`,
      payload: { reason: 'spam', explanation: 'An ad.' }
    });
    const hidden = await publicProject(api, ada, 'Hidden later');
    await machine.apply(await verdictFor(hidden, SEVERE));

    const open = await moderation.openReports();
    const machineHidden = open.map(
      (report) => report.document?.hiddenBy === 'machine'
    );
    expect(machineHidden).toContain(false);
    expect(machineHidden).toEqual([...machineHidden].sort().reverse());
    expect(open.find((r) => r.document?.id === hidden.id)?.source).toBe(
      'machine'
    );
    expect(open.find((r) => r.document?.id === reader.id)?.source).toBe(
      'reader'
    );
  });
});

describe('machine moderation verdicts with auto-hide off', () => {
  let api: E2eApp;

  beforeAll(async () => {
    api = await startE2eApp({ REPORT_MAIL_TO: OPERATOR });
  });

  afterAll(async () => {
    await api.close();
  });

  it('reports a certain severe verdict and hides nothing', async () => {
    const ada = await signUp(api, OWNER, 'Ada');
    const project = await publicProject(api, ada, 'Not hidden');
    api.mail.clear();

    const result = await api.app.get(MachineModerationService).apply({
      kind: 'project',
      documentId: project.id,
      textDigest: await textDigest(api, project.id),
      verdict: SEVERE,
      call: CALL
    });

    expect(result).toBe('reported');
    const page = await api.inject({
      method: 'GET',
      url: `/api/community/projects/${project.link}`
    });
    expect(page.statusCode).toBe(200);
    expect(await machineReports(api, project.id)).toHaveLength(1);
    expect(api.mail.sent.map((mail) => mail.to)).toEqual([OPERATOR]);
  });
});
