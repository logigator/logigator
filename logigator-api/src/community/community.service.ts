import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gt,
  isNull,
  ne,
  sql,
  type Column,
  type SQL
} from 'drizzle-orm';
import type {
  Author,
  CommunityComponent,
  CommunityComponentDetail,
  CommunityPageQuery,
  CommunityProject,
  CommunityProjectDetail,
  CommunityQuery,
  DocumentTranslationResponse,
  Page,
  PageQuery,
  PublicProfile,
  StarResponse
} from '@logigator/contract';
import { alias } from 'drizzle-orm/pg-core';
import { EXAMPLES_ACCOUNT_ID, type LanguageId } from '@logigator/core';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import {
  componentStars,
  componentTexts,
  components,
  projectStars,
  projectTexts,
  projects,
  users,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import {
  findByLink,
  forkLineage,
  linkResolvesFor,
  nameMatches
} from '../documents/circuit-queries';
import {
  toAuthor,
  toComponentSummary,
  toHidden,
  toProjectSummary
} from '../documents/circuit-responses';
import { machineTextFor, textOn } from '../documents/document-text-queries';
import { awaitingCheck } from '../documents/text-check';
import {
  resolveTexts,
  type OriginalTexts,
  type ResolvedTexts
} from '../documents/document-texts';
import { AVATAR_VARIANTS, variantUrls } from '../storage/image-variants';
import { toSocialLinks } from '../users/social-links';
import {
  receivedStarCount,
  starCount,
  starCountSince,
  starredByCaller,
  starTally
} from './star-queries';

/** The author columns every public response carries. */
const authorColumns = {
  id: users.id,
  username: users.username,
  avatarId: users.avatarId
} as const;

/** A page of exactly one, for the detail endpoints. */
const JUST_ONE: PageQuery = { page: 0, size: 1 };

/**
 * The text tables under the names the joins below give them: the author's
 * version in the reader's language beside every row, and, for the translation
 * endpoint alone, the machine row of that language.
 */
const projectHuman = alias(projectTexts, 'human_text');
const componentHuman = alias(componentTexts, 'human_text');
const projectMachine = alias(projectTexts, 'machine_text');
const componentMachine = alias(componentTexts, 'machine_text');

/**
 * What a community row carries beside its document: the author's version in
 * the reader's language, if any, and whether a current machine text exists per
 * field. Never the machine text itself.
 */
interface TextColumns {
  humanName: string | null;
  humanDescription: string | null;
  machineName: boolean;
  machineDescription: boolean;
}

/**
 * How far back a star still counts as trending. A named constant rather than an
 * env var: it is a ranking rule, data in code the way the image matrices are,
 * and two deployments ranking differently is a support question nobody could
 * answer.
 */
const TRENDING_WINDOW_DAYS = 30;

/**
 * Either star table. Both are a plain join of an account to a document; only
 * the name of the circuit column differs, so the "how many" and "who" queries
 * are written once and handed the table plus its columns.
 */
type StarTable = typeof projectStars | typeof componentStars;

/**
 * A document's page, and the section it lives in: everything a visitor who was
 * not handed a link can reach.
 *
 * Two predicates, and nothing else. The **listings** — the browse pages, a
 * profile's tabs and counts, the starred tabs — carry {@link listed}: a
 * published document with something on it, whose text has been checked, is the
 * only kind a stranger is told about (a star and its stargazers ask only that
 * it be published). The browse
 * pages also leave out the examples account, whose public documents are the
 * site's examples rather than community work: its profile, its documents'
 * pages and a member's starred tab still show them. A **read
 * addressed by a link** carries `linkResolvesFor`, which answers an unlisted
 * document for whoever holds the URL and a private or hidden one for its owner
 * alone, so a hidden document is in no listing and its page is its owner's.
 * The two are separate questions about the same rows, which is why these
 * queries live apart from the owner-scoped ones rather than being those with a
 * clause flipped: sharing no query means no place to forget one.
 *
 * Documents are addressed by their `link`, so regenerating the token takes the
 * page down with it.
 */
@Injectable()
export class CommunityService {
  /** Whether a published text waits for its check before it is listed. */
  private readonly analysisRuns: boolean;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) env: Env
  ) {
    this.analysisRuns = env.TEXT_ANALYSIS_WORKER_ENABLED;
  }

  // ---- listings ----

  async listProjects(
    query: CommunityQuery,
    callerId: string | null
  ): Promise<Page<CommunityProject>> {
    const where = and(
      listed(projects, this.analysisRuns),
      ne(projects.userId, EXAMPLES_ACCOUNT_ID),
      nameMatches(projects, query.search)
    );
    return this.projectPage(where, query, callerId, this.projectRanking(query));
  }

  async listComponents(
    query: CommunityQuery,
    callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    const where = and(
      listed(components, this.analysisRuns),
      ne(components.userId, EXAMPLES_ACCOUNT_ID),
      nameMatches(components, query.search)
    );
    return this.componentPage(
      where,
      query,
      callerId,
      this.componentRanking(query)
    );
  }

  /** A user's published work, for their profile. */
  listUserProjects(
    userId: string,
    query: CommunityPageQuery,
    callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.projectPage(
      and(listed(projects, this.analysisRuns), eq(projects.userId, userId)),
      query,
      callerId
    );
  }

  listUserComponents(
    userId: string,
    query: CommunityPageQuery,
    callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.componentPage(
      and(listed(components, this.analysisRuns), eq(components.userId, userId)),
      query,
      callerId
    );
  }

  /**
   * What an account has starred: the ordinary listing with the same `EXISTS`
   * that fills in `starred` as one more predicate. A star on something since
   * made private, or since emptied, stops being listed, and one whose text was
   * edited is listed again once the new text is checked.
   *
   * Whose stars are listed and whose flag is reported are two different
   * accounts — a visitor reading somebody's public starred tab gets their own
   * `starred` — so the caller is passed separately rather than reused. The
   * caller-scoped route hands the same id twice.
   */
  listStarredProjects(
    userId: string,
    query: CommunityPageQuery,
    callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.projectPage(
      and(listed(projects, this.analysisRuns), this.projectStarredBy(userId)),
      query,
      callerId
    );
  }

  listStarredComponents(
    userId: string,
    query: CommunityPageQuery,
    callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.componentPage(
      and(
        listed(components, this.analysisRuns),
        this.componentStarredBy(userId)
      ),
      query,
      callerId
    );
  }

  // ---- one document's page, in whatever state it is in ----

  /**
   * A document's page, reached by the link its owner hands out — which is why
   * this is the one read here that is not restricted to published documents. An
   * unlisted document's page is drawn for whoever holds the URL, and a private
   * one's for its owner, who is looking at the preview the dialogs promise
   * them. Whether the page then offers a star, a trail or an index entry is the
   * site's business: the state travels on the row, this answers the document.
   */
  async projectDetail(
    link: string,
    language: LanguageId,
    callerId: string | null
  ): Promise<CommunityProjectDetail> {
    const [row] = await this.projectRows(
      and(linkResolvesFor(projects, callerId), eq(projects.link, link)),
      { ...JUST_ONE, lang: language },
      callerId
    );
    if (!row) throw notPublished();

    return {
      ...this.toCommunityProject(row, language),
      forkedFrom: await this.parentOf(projects, row.circuit),
      awaitingCheck: row.awaitingCheck,
      ...ownerFields(row.circuit, callerId)
    };
  }

  async componentDetail(
    link: string,
    language: LanguageId,
    callerId: string | null
  ): Promise<CommunityComponentDetail> {
    const [row] = await this.componentRows(
      and(linkResolvesFor(components, callerId), eq(components.link, link)),
      { ...JUST_ONE, lang: language },
      callerId
    );
    if (!row) throw notPublished();

    return {
      ...this.toCommunityComponent(row, language),
      forkedFrom: await this.parentOf(components, row.circuit),
      awaitingCheck: row.awaitingCheck,
      ...ownerFields(row.circuit, callerId)
    };
  }

  /**
   * The machine translation of a document's texts into one language, for the
   * reader who asked for it. The only read that returns machine text: every
   * other response carries the flag alone, and this answers exactly the fields
   * the flag was raised for, by the same resolution. Nothing to offer is a
   * `404`, as is a link that does not resolve for the caller.
   */
  async projectTranslation(
    link: string,
    language: LanguageId,
    callerId: string | null
  ): Promise<DocumentTranslationResponse> {
    const [row] = await this.db
      .select({
        circuit: originalColumns(projects),
        humanName: projectHuman.name,
        humanDescription: projectHuman.description,
        machineDigest: projectMachine.sourceDigest,
        machineName: projectMachine.name,
        machineDescription: projectMachine.description
      })
      .from(projects)
      .leftJoin(
        projectHuman,
        textOn(projectHuman, projects.id, language, 'human')
      )
      .leftJoin(
        projectMachine,
        textOn(projectMachine, projects.id, language, 'machine')
      )
      .where(and(linkResolvesFor(projects, callerId), eq(projects.link, link)))
      .limit(1);
    return toTranslation(row, language);
  }

  async componentTranslation(
    link: string,
    language: LanguageId,
    callerId: string | null
  ): Promise<DocumentTranslationResponse> {
    const [row] = await this.db
      .select({
        circuit: originalColumns(components),
        humanName: componentHuman.name,
        humanDescription: componentHuman.description,
        machineDigest: componentMachine.sourceDigest,
        machineName: componentMachine.name,
        machineDescription: componentMachine.description
      })
      .from(components)
      .leftJoin(
        componentHuman,
        textOn(componentHuman, components.id, language, 'human')
      )
      .leftJoin(
        componentMachine,
        textOn(componentMachine, components.id, language, 'machine')
      )
      .where(
        and(linkResolvesFor(components, callerId), eq(components.link, link))
      )
      .limit(1);
    return toTranslation(row, language);
  }

  // ---- stars ----

  async setProjectStar(
    userId: string,
    link: string,
    starred: boolean
  ): Promise<StarResponse> {
    const row = await this.requirePublicProject(link);

    if (starred) {
      await this.db
        .insert(projectStars)
        .values({ userId, projectId: row.id })
        .onConflictDoNothing();
    } else {
      await this.db
        .delete(projectStars)
        .where(
          and(
            eq(projectStars.userId, userId),
            eq(projectStars.projectId, row.id)
          )
        );
    }

    return {
      starred,
      stars: await starTally(
        this.db,
        projectStars,
        projectStars.projectId,
        row.id
      )
    };
  }

  async setComponentStar(
    userId: string,
    link: string,
    starred: boolean
  ): Promise<StarResponse> {
    const row = await this.requirePublicComponent(link);

    if (starred) {
      await this.db
        .insert(componentStars)
        .values({ userId, componentId: row.id })
        .onConflictDoNothing();
    } else {
      await this.db
        .delete(componentStars)
        .where(
          and(
            eq(componentStars.userId, userId),
            eq(componentStars.componentId, row.id)
          )
        );
    }

    return {
      starred,
      stars: await starTally(
        this.db,
        componentStars,
        componentStars.componentId,
        row.id
      )
    };
  }

  async projectStargazers(
    link: string,
    query: PageQuery
  ): Promise<Page<Author>> {
    const row = await this.requirePublicProject(link);
    return this.stargazers(
      projectStars,
      projectStars.projectId,
      projectStars.userId,
      projectStars.starredAt,
      row.id,
      query
    );
  }

  async componentStargazers(
    link: string,
    query: PageQuery
  ): Promise<Page<Author>> {
    const row = await this.requirePublicComponent(link);
    return this.stargazers(
      componentStars,
      componentStars.componentId,
      componentStars.userId,
      componentStars.starredAt,
      row.id,
      query
    );
  }

  // ---- profiles ----

  /**
   * A public profile is its own shape, not the account holder's view with
   * fields omitted — there is nothing here to leave out, so no serialization
   * group to get wrong.
   */
  async profile(userId: string): Promise<PublicProfile> {
    // The tally rides in the same select rather than in the `Promise.all`
    // below: it is a column of this answer, correlated on the row being read.
    const [row] = await this.db
      .select({
        user: users,
        stars: receivedStarCount(users.id)
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = row?.user;
    if (!user) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'No such user.'
      );
    }

    const [[projectCount], [componentCount]] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(projects)
        .where(
          and(eq(projects.userId, userId), listed(projects, this.analysisRuns))
        ),
      this.db
        .select({ value: count() })
        .from(components)
        .where(
          and(
            eq(components.userId, userId),
            listed(components, this.analysisRuns)
          )
        )
    ]);

    return {
      id: user.id,
      username: user.username,
      avatar: user.avatarId
        ? variantUrls('profile', user.avatarId, AVATAR_VARIANTS)
        : null,
      bio: user.bio,
      websiteUrl: user.websiteUrl,
      socialLinks: toSocialLinks(user.socialLinks),
      memberSince: user.memberSince.toISOString(),
      publicProjects: projectCount?.value ?? 0,
      publicComponents: componentCount?.value ?? 0,
      // `count(*)` is `bigint`; the sum of the two is one too.
      stars: Number(row?.stars ?? 0)
    };
  }

  // ---- the two queries everything above is built from ----

  /**
   * The rows of a community read, with the texts resolved for `query.lang`
   * read in the same statement: the author's version through a left join, and
   * the machine rows only as `EXISTS`, so their text never leaves the
   * database here.
   */
  private projectRows(
    where: SQL | undefined,
    query: CommunityPageQuery,
    callerId: string | null,
    order: SQL[] = [desc(projects.lastEditedAt), desc(projects.id)]
  ) {
    return (
      this.db
        .select({
          circuit: projects,
          author: authorColumns,
          stars: starCount(projectStars, projectStars.projectId, projects.id),
          starred: this.projectStarredBy(callerId),
          awaitingCheck: awaitingCheck(projects, this.analysisRuns),
          humanName: projectHuman.name,
          humanDescription: projectHuman.description,
          machineName: machineTextFor(projects, 'name', query.lang),
          machineDescription: machineTextFor(
            projects,
            'description',
            query.lang
          )
        })
        .from(projects)
        // Inner, not left: the owner column cascades, so a document without an
        // author cannot exist.
        .innerJoin(users, eq(users.id, projects.userId))
        .leftJoin(
          projectHuman,
          textOn(projectHuman, projects.id, query.lang, 'human')
        )
        .where(where)
        .orderBy(...order)
        .limit(query.size)
        .offset(query.page * query.size)
    );
  }

  private componentRows(
    where: SQL | undefined,
    query: CommunityPageQuery,
    callerId: string | null,
    order: SQL[] = [desc(components.lastEditedAt), desc(components.id)]
  ) {
    return this.db
      .select({
        circuit: components,
        author: authorColumns,
        stars: starCount(
          componentStars,
          componentStars.componentId,
          components.id
        ),
        starred: this.componentStarredBy(callerId),
        awaitingCheck: awaitingCheck(components, this.analysisRuns),
        humanName: componentHuman.name,
        humanDescription: componentHuman.description,
        machineName: machineTextFor(components, 'name', query.lang),
        machineDescription: machineTextFor(
          components,
          'description',
          query.lang
        )
      })
      .from(components)
      .innerJoin(users, eq(users.id, components.userId))
      .leftJoin(
        componentHuman,
        textOn(componentHuman, components.id, query.lang, 'human')
      )
      .where(where)
      .orderBy(...order)
      .limit(query.size)
      .offset(query.page * query.size);
  }

  private async projectPage(
    where: SQL | undefined,
    query: CommunityPageQuery,
    callerId: string | null,
    order?: SQL[]
  ): Promise<Page<CommunityProject>> {
    const [rows, [totals]] = await Promise.all([
      this.projectRows(where, query, callerId, order),
      this.db.select({ value: count() }).from(projects).where(where)
    ]);

    return {
      entries: rows.map((row) => this.toCommunityProject(row, query.lang)),
      page: query.page,
      pageSize: query.size,
      total: totals?.value ?? 0
    };
  }

  private async componentPage(
    where: SQL | undefined,
    query: CommunityPageQuery,
    callerId: string | null,
    order?: SQL[]
  ): Promise<Page<CommunityComponent>> {
    const [rows, [totals]] = await Promise.all([
      this.componentRows(where, query, callerId, order),
      this.db.select({ value: count() }).from(components).where(where)
    ]);

    return {
      entries: rows.map((row) => this.toCommunityComponent(row, query.lang)),
      page: query.page,
      pageSize: query.size,
      total: totals?.value ?? 0
    };
  }

  // ---- pieces ----

  private toCommunityProject(
    row: TextColumns & {
      circuit: ProjectRow;
      author: { id: string; username: string; avatarId: string | null };
      stars: number;
      starred: boolean;
    },
    language: LanguageId
  ): CommunityProject {
    return {
      ...toProjectSummary(row.circuit),
      ...resolvedFields(resolveRowTexts(row.circuit, row, language)),
      author: toAuthor(row.author),
      // `count(*)` is `bigint`, which `pg` hands over as a string.
      stars: Number(row.stars),
      starred: row.starred
    };
  }

  private toCommunityComponent(
    row: TextColumns & {
      circuit: ComponentRow;
      author: { id: string; username: string; avatarId: string | null };
      stars: number;
      starred: boolean;
    },
    language: LanguageId
  ): CommunityComponent {
    return {
      ...toComponentSummary(row.circuit),
      ...resolvedFields(resolveRowTexts(row.circuit, row, language)),
      author: toAuthor(row.author),
      stars: Number(row.stars),
      starred: row.starred
    };
  }

  private projectStarredBy(userId: string | null): SQL<boolean> {
    return starredByCaller(
      projectStars,
      projectStars.projectId,
      projects.id,
      projectStars.userId,
      userId
    );
  }

  private componentStarredBy(userId: string | null): SQL<boolean> {
    return starredByCaller(
      componentStars,
      componentStars.componentId,
      components.id,
      componentStars.userId,
      userId
    );
  }

  /**
   * The three rankings, each a chain rather than a single key.
   *
   * `trending` leads with the stars collected inside the window, then falls
   * through to the lifetime tally and to edit time — which is what makes it
   * safe as the default from the day it ships: with no stars inside the window
   * it degenerates to exactly what `stars` answers with.
   *
   * Every chain ends at `id`. Paging is `OFFSET`-based, so a tie the database
   * is free to break differently between two requests drops or repeats a row.
   */
  private projectRanking(query: CommunityQuery): SQL[] {
    const total = starCount(projectStars, projectStars.projectId, projects.id);
    const window = starCountSince(
      projectStars,
      projectStars.projectId,
      projects.id,
      projectStars.starredAt,
      TRENDING_WINDOW_DAYS
    );
    return this.ranking(query.orderBy, total, window, [
      desc(projects.lastEditedAt),
      desc(projects.id)
    ]);
  }

  private componentRanking(query: CommunityQuery): SQL[] {
    const total = starCount(
      componentStars,
      componentStars.componentId,
      components.id
    );
    const window = starCountSince(
      componentStars,
      componentStars.componentId,
      components.id,
      componentStars.starredAt,
      TRENDING_WINDOW_DAYS
    );
    return this.ranking(query.orderBy, total, window, [
      desc(components.lastEditedAt),
      desc(components.id)
    ]);
  }

  private ranking(
    orderBy: CommunityQuery['orderBy'],
    total: SQL<number>,
    window: SQL<number>,
    tail: SQL[]
  ): SQL[] {
    switch (orderBy) {
      case 'latest':
        return tail;
      case 'stars':
        return [desc(total), ...tail];
      case 'trending':
        return [desc(window), desc(total), ...tail];
    }
  }

  /** Who starred it, most recent first. */
  private async stargazers(
    stars: StarTable,
    starredCircuit: Column,
    starredBy: Column,
    starredAt: Column,
    id: string,
    query: PageQuery
  ): Promise<Page<Author>> {
    const where = eq(starredCircuit, id);
    const [rows, [totals]] = await Promise.all([
      this.db
        .select(authorColumns)
        .from(stars)
        .innerJoin(users, eq(users.id, starredBy))
        .where(where)
        .orderBy(desc(starredAt), desc(starredBy))
        .limit(query.size)
        .offset(query.page * query.size),
      this.db.select({ value: count() }).from(stars).where(where)
    ]);

    return {
      entries: rows.map((row) => toAuthor(row)),
      page: query.page,
      pageSize: query.size,
      total: totals?.value ?? 0
    };
  }

  /**
   * A published document, for the things only a listing entry can be given: a
   * star, and the list of who gave one. `linkResolvesFor` is deliberately not
   * what is asked here — an unlisted document's link resolves, and it is still
   * not in any listing for a star to hang off. Calling the state by its name is
   * the whole rule, and a hidden document is in no listing either.
   */
  private async requirePublicProject(link: string): Promise<ProjectRow> {
    const row = await findByLink(this.db, projects, link);
    if (!row || !isListedState(row)) throw notPublished();
    return row;
  }

  private async requirePublicComponent(link: string): Promise<ComponentRow> {
    const row = await findByLink(this.db, components, link);
    if (!row || !isListedState(row)) throw notPublished();
    return row;
  }

  /**
   * The document this one was forked from — the last entry of the root-first
   * lineage. Named even when the ancestor is not published: withholding the
   * credit because they unpublished would turn a fork into original work.
   */
  private async parentOf(
    table: typeof projects | typeof components,
    row: ProjectRow | ComponentRow
  ): Promise<CommunityProjectDetail['forkedFrom']> {
    if (!row.forkedFromId) return null;

    const parent = (await forkLineage(this.db, table, row)).at(-1);
    return parent
      ? {
          id: parent.id,
          name: parent.name,
          link: parent.link,
          authorName: parent.authorName
        }
      : null;
  }
}

/**
 * The predicate every listing carries: published, not hidden by moderation,
 * not empty, and with its current text checked. A document with neither a
 * component nor a wire on it — the blank board the shelf's _New project_
 * creates, or one its author cleared — has nothing to show a stranger, and
 * publishing it is more often a slip than a statement. A text the automatic
 * check has not yet seen, while text analysis runs, is not advertised before
 * it has been: a new document, or one whose name or description was just
 * edited, waits the few minutes the worker takes (`text-check.ts`, which the
 * reads select too, so the owner is told by the same rule). Either way its
 * page still resolves by its link and it can still be starred there: both
 * only decide whether it is *advertised*, which is the listings' question
 * alone.
 *
 * Read off columns every write keeps current, so the rule follows an edit
 * without a column of its own. Written out as SQL for the same reason
 * `linkResolvesFor` is: drizzle's `or()` is typed `SQL | undefined`, and an
 * `undefined` inside the caller's `and()` would drop the rule silently.
 */
function listed(
  table: typeof projects | typeof components,
  analysisRuns: boolean
): SQL {
  return sql`(${eq(table.visibility, 'public')} and ${isNull(table.hiddenAt)} and (${gt(table.componentCount, 0)} or ${gt(table.wireCount, 0)}) and not ${awaitingCheck(table, analysisRuns)})`;
}

/** {@link listed}'s state half, for a row already in hand. */
function isListedState(row: ProjectRow | ComponentRow): boolean {
  return row.visibility === 'public' && row.hiddenAt === null;
}

/**
 * What a document's page tells its owner alone. Anybody else is never answered
 * a hidden document, so for them the field is left out rather than `null`.
 */
function ownerFields(
  row: ProjectRow | ComponentRow,
  callerId: string | null
): { hidden?: ReturnType<typeof toHidden> } {
  return row.userId === callerId ? { hidden: toHidden(row) } : {};
}

function notPublished(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'not_found',
    'No such published document.'
  );
}

/** The columns the resolution reads off a document row. */
function originalColumns(table: typeof projects | typeof components) {
  return {
    name: table.name,
    description: table.description,
    textDigest: table.textDigest,
    analyzedDigest: table.analyzedDigest,
    nameLanguage: table.nameLanguage,
    descriptionLanguage: table.descriptionLanguage
  };
}

/**
 * Resolves a community row. The machine `EXISTS` already compared the digest,
 * so a field it found is current for the text the row holds.
 */
function resolveRowTexts(
  circuit: OriginalTexts,
  row: TextColumns,
  language: LanguageId
): ResolvedTexts {
  return resolveTexts(
    circuit,
    { name: row.humanName, description: row.humanDescription },
    {
      sourceDigest: circuit.textDigest,
      name: row.machineName,
      description: row.machineDescription
    },
    language
  );
}

/** The resolved texts in the fields a community response carries them in. */
function resolvedFields(texts: ResolvedTexts) {
  return {
    name: texts.name.text,
    description: texts.description.text,
    textLanguage: {
      name: texts.name.language,
      description: texts.description.language
    },
    machineTranslation: texts.machineTranslation
  };
}

/**
 * The translation endpoint's answer for a row it read, or a `404` when the
 * link does not resolve or no field offers a machine text.
 */
function toTranslation(
  row:
    | {
        circuit: OriginalTexts;
        humanName: string | null;
        humanDescription: string | null;
        machineDigest: string | null;
        machineName: string | null;
        machineDescription: string | null;
      }
    | undefined,
  language: LanguageId
): DocumentTranslationResponse {
  if (!row) throw notPublished();

  const texts = resolveTexts(
    row.circuit,
    { name: row.humanName, description: row.humanDescription },
    row.machineDigest === null
      ? null
      : {
          sourceDigest: row.machineDigest,
          name: row.machineName !== null,
          description: row.machineDescription !== null
        },
    language
  );
  if (!texts.machineTranslation) {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      'not_found',
      'No machine translation into this language.'
    );
  }

  return {
    language,
    name: texts.name.machineTranslation ? row.machineName : null,
    description: texts.description.machineTranslation
      ? row.machineDescription
      : null,
    sourceLanguage: {
      name: texts.name.machineTranslation ? texts.name.language : null,
      description: texts.description.machineTranslation
        ? texts.description.language
        : null
    }
  };
}
