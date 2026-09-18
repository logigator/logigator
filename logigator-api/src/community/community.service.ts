import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, type Column, type SQL } from 'drizzle-orm';
import type {
  Author,
  CommunityComponent,
  CommunityComponentDetail,
  CommunityProject,
  CommunityProjectDetail,
  CommunityQuery,
  Page,
  PageQuery,
  PublicProfile,
  StarResponse
} from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { DB, type Database } from '../database/database.module';
import {
  componentStars,
  components,
  projectStars,
  projects,
  users,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import {
  findByLink,
  forkLineage,
  nameMatches
} from '../documents/circuit-queries';
import {
  toAuthor,
  toComponentSummary,
  toProjectSummary
} from '../documents/circuit-responses';
import { AVATAR_VARIANTS, variantUrls } from '../storage/image-variants';
import { starCount, starCountSince, starredByCaller } from './star-queries';

/** The author columns every public response carries. */
const authorColumns = {
  id: users.id,
  username: users.username,
  avatarId: users.avatarId
} as const;

/** A page of exactly one, for the detail endpoints. */
const JUST_ONE: PageQuery = { page: 0, size: 1 };

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
 * What everybody can see: the documents their owners chose to publish.
 *
 * Every predicate here carries `public = true`. That is the whole access rule,
 * and it is why these queries live apart from the owner-scoped ones rather than
 * being the same ones with a flag flipped — sharing no query means no place to
 * forget the clause. A share link is the other way in, and independent of the
 * flag: publishing is `public`, sharing is the token.
 *
 * Documents are addressed by their `link`, so regenerating the token takes the
 * public page down with it.
 */
@Injectable()
export class CommunityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---- listings ----

  async listProjects(
    query: CommunityQuery,
    callerId: string | null
  ): Promise<Page<CommunityProject>> {
    const where = and(
      eq(projects.public, true),
      nameMatches(projects.name, query.search)
    );
    return this.projectPage(where, query, callerId, this.projectRanking(query));
  }

  async listComponents(
    query: CommunityQuery,
    callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    const where = and(
      eq(components.public, true),
      nameMatches(components.name, query.search)
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
    query: PageQuery,
    callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.projectPage(
      and(eq(projects.public, true), eq(projects.userId, userId)),
      query,
      callerId
    );
  }

  listUserComponents(
    userId: string,
    query: PageQuery,
    callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.componentPage(
      and(eq(components.public, true), eq(components.userId, userId)),
      query,
      callerId
    );
  }

  /**
   * What an account has starred: the ordinary listing with the same `EXISTS`
   * that fills in `starred` as one more predicate. A star on something since
   * made private stops being listed.
   *
   * Whose stars are listed and whose flag is reported are two different
   * accounts — a visitor reading somebody's public starred tab gets their own
   * `starred` — so the caller is passed separately rather than reused. The
   * caller-scoped route hands the same id twice.
   */
  listStarredProjects(
    userId: string,
    query: PageQuery,
    callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.projectPage(
      and(eq(projects.public, true), this.projectStarredBy(userId)),
      query,
      callerId
    );
  }

  listStarredComponents(
    userId: string,
    query: PageQuery,
    callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.componentPage(
      and(eq(components.public, true), this.componentStarredBy(userId)),
      query,
      callerId
    );
  }

  // ---- one document's public page ----

  async projectDetail(
    link: string,
    callerId: string | null
  ): Promise<CommunityProjectDetail> {
    const [row] = await this.projectRows(
      and(eq(projects.public, true), eq(projects.link, link)),
      JUST_ONE,
      callerId
    );
    if (!row) throw notPublished();

    return {
      ...this.toCommunityProject(row),
      forkedFrom: await this.parentOf(projects, row.circuit)
    };
  }

  async componentDetail(
    link: string,
    callerId: string | null
  ): Promise<CommunityComponentDetail> {
    const [row] = await this.componentRows(
      and(eq(components.public, true), eq(components.link, link)),
      JUST_ONE,
      callerId
    );
    if (!row) throw notPublished();

    return {
      ...this.toCommunityComponent(row),
      forkedFrom: await this.parentOf(components, row.circuit)
    };
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
      stars: await this.tally(projectStars, projectStars.projectId, row.id)
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
      stars: await this.tally(
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
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

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
        .where(and(eq(projects.userId, userId), eq(projects.public, true))),
      this.db
        .select({ value: count() })
        .from(components)
        .where(and(eq(components.userId, userId), eq(components.public, true)))
    ]);

    return {
      id: user.id,
      username: user.username,
      avatar: user.avatarId
        ? variantUrls('profile', user.avatarId, AVATAR_VARIANTS)
        : null,
      memberSince: user.memberSince.toISOString(),
      publicProjects: projectCount?.value ?? 0,
      publicComponents: componentCount?.value ?? 0
    };
  }

  // ---- the two queries everything above is built from ----

  private projectRows(
    where: SQL | undefined,
    query: PageQuery,
    callerId: string | null,
    order: SQL[] = [desc(projects.lastEditedAt), desc(projects.id)]
  ) {
    return (
      this.db
        .select({
          circuit: projects,
          author: authorColumns,
          stars: starCount(projectStars, projectStars.projectId, projects.id),
          starred: this.projectStarredBy(callerId)
        })
        .from(projects)
        // Inner, not left: the owner column cascades, so a document without an
        // author cannot exist.
        .innerJoin(users, eq(users.id, projects.userId))
        .where(where)
        .orderBy(...order)
        .limit(query.size)
        .offset(query.page * query.size)
    );
  }

  private componentRows(
    where: SQL | undefined,
    query: PageQuery,
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
        starred: this.componentStarredBy(callerId)
      })
      .from(components)
      .innerJoin(users, eq(users.id, components.userId))
      .where(where)
      .orderBy(...order)
      .limit(query.size)
      .offset(query.page * query.size);
  }

  private async projectPage(
    where: SQL | undefined,
    query: PageQuery,
    callerId: string | null,
    order?: SQL[]
  ): Promise<Page<CommunityProject>> {
    const [rows, [totals]] = await Promise.all([
      this.projectRows(where, query, callerId, order),
      this.db.select({ value: count() }).from(projects).where(where)
    ]);

    return {
      entries: rows.map((row) => this.toCommunityProject(row)),
      page: query.page,
      pageSize: query.size,
      total: totals?.value ?? 0
    };
  }

  private async componentPage(
    where: SQL | undefined,
    query: PageQuery,
    callerId: string | null,
    order?: SQL[]
  ): Promise<Page<CommunityComponent>> {
    const [rows, [totals]] = await Promise.all([
      this.componentRows(where, query, callerId, order),
      this.db.select({ value: count() }).from(components).where(where)
    ]);

    return {
      entries: rows.map((row) => this.toCommunityComponent(row)),
      page: query.page,
      pageSize: query.size,
      total: totals?.value ?? 0
    };
  }

  // ---- pieces ----

  private toCommunityProject(row: {
    circuit: ProjectRow;
    author: { id: string; username: string; avatarId: string | null };
    stars: number;
    starred: boolean;
  }): CommunityProject {
    return {
      ...toProjectSummary(row.circuit),
      author: toAuthor(row.author),
      // `count(*)` is `bigint`, which `pg` hands over as a string.
      stars: Number(row.stars),
      starred: row.starred
    };
  }

  private toCommunityComponent(row: {
    circuit: ComponentRow;
    author: { id: string; username: string; avatarId: string | null };
    stars: number;
    starred: boolean;
  }): CommunityComponent {
    return {
      ...toComponentSummary(row.circuit),
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

  private async tally(
    stars: StarTable,
    starredCircuit: Column,
    id: string
  ): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(stars)
      .where(eq(starredCircuit, id));
    return row?.value ?? 0;
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

  private async requirePublicProject(link: string): Promise<ProjectRow> {
    const row = await findByLink(this.db, projects, link);
    if (!row?.public) throw notPublished();
    return row;
  }

  private async requirePublicComponent(link: string): Promise<ComponentRow> {
    const row = await findByLink(this.db, components, link);
    if (!row?.public) throw notPublished();
    return row;
  }

  /**
   * The document this one was forked from — the last entry of the root-first
   * lineage. Named even when the ancestor is not public: withholding the credit
   * because they unpublished would turn a fork into original work.
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

function notPublished(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'not_found',
    'No such published document.'
  );
}
