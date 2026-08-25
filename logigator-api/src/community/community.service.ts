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
import { starCount, starredByCaller } from './star-queries';

/** The author columns every public response carries. */
const authorColumns = {
  id: users.id,
  username: users.username,
  avatarId: users.avatarId
} as const;

/** A page of exactly one, for the detail endpoints. */
const JUST_ONE: PageQuery = { page: 0, size: 1 };

/**
 * Either star table. Both are a plain join of an account to a document, so the
 * queries that only need "how many" and "who" are written once and handed the
 * table with the columns to use — their circuit column has a different name on
 * each, which is the only thing keeping them from being one table.
 */
type StarTable = typeof projectStars | typeof componentStars;

/**
 * What everybody can see: the documents their owners chose to publish.
 *
 * Every predicate here carries `public = true`. That is the whole access rule,
 * and it is why these queries live apart from the owner-scoped ones rather than
 * being the same ones with a flag flipped — there is no single place the clause
 * could be forgotten if the two never share a query at all.
 *
 * A share link is the other way in, and a different thing: it grants one
 * document to whoever holds it, whatever this flag says. Publishing is `public`;
 * sharing is the token.
 *
 * Documents are addressed here by their `link`, as the legacy community pages
 * were. The token is a document's public name, so regenerating it takes the
 * public page with it — the same revocation the share link gets, for free.
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
   * What the caller has starred.
   *
   * The membership test is the same `EXISTS` that fills in `starred`, so this is
   * the ordinary listing with one more predicate rather than a query of its own
   * shape. A star on something since made private stops being listed, which is
   * what `public = true` everywhere means.
   */
  listStarredProjects(
    userId: string,
    query: PageQuery
  ): Promise<Page<CommunityProject>> {
    return this.projectPage(
      and(eq(projects.public, true), this.projectStarredBy(userId)),
      query,
      userId
    );
  }

  listStarredComponents(
    userId: string,
    query: PageQuery
  ): Promise<Page<CommunityComponent>> {
    return this.componentPage(
      and(eq(components.public, true), this.componentStarredBy(userId)),
      query,
      userId
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
      // Starring twice is starring once. A double-tapped button is not a
      // conflict worth reporting.
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
   * A public profile: strictly less than the account holder's own view of
   * themselves, and a separate shape rather than that one with fields omitted.
   * There are no serialization groups to get wrong because there is nothing here
   * to leave out.
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
    order: SQL[] = [desc(projects.lastEditedAt)]
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
        // Inner, not left: the owner column cascades, so a document without one
        // cannot exist — and a left join would invite handling a row that cannot
        // occur.
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
    order: SQL[] = [desc(components.lastEditedAt)]
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
      // `count(*)` is `bigint`, which `pg` hands over as a string rather than
      // lose precision — a number here or the contract is a lie.
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
   * Most-starred first by default, newest-edited first on request.
   *
   * Stars alone leave every unstarred document tied, so the edit time breaks the
   * tie. Without it the tail of a browse page would come back in whatever order
   * the planner happened to produce, and paging through it would repeat and skip
   * rows.
   */
  private projectRanking(query: CommunityQuery): SQL[] {
    const newest = desc(projects.lastEditedAt);
    return query.orderBy === 'latest'
      ? [newest]
      : [
          desc(starCount(projectStars, projectStars.projectId, projects.id)),
          newest
        ];
  }

  private componentRanking(query: CommunityQuery): SQL[] {
    const newest = desc(components.lastEditedAt);
    return query.orderBy === 'latest'
      ? [newest]
      : [
          desc(
            starCount(componentStars, componentStars.componentId, components.id)
          ),
          newest
        ];
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
        .orderBy(desc(starredAt))
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
   * The document this one was forked from, with the link its own public page
   * lives at — the credit a community page shows.
   *
   * The last entry of the lineage, since the chain is root-first. Named even when
   * the ancestor is not itself public: the whole point of the fork record is that
   * the original creator is credited, and withholding the name because they have
   * since unpublished would quietly turn a fork into original work.
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
