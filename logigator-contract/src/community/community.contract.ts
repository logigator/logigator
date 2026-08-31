import * as z from 'zod';
import { imageVariantSchema } from '../image/image.contract';
import { pageQuerySchema, pageSchema } from '../page/page.contract';
import { authorSchema } from '../document/document.contract';
import { componentSummarySchema } from '../document/component.contract';
import { projectSummarySchema } from '../document/project.contract';

/** A community listing's query, ranked by stars unless asked for `latest`. */
export const communityQuerySchema = pageQuerySchema.extend({
  orderBy: z.enum(['stars', 'latest']).default('stars')
});

export type CommunityQuery = z.infer<typeof communityQuerySchema>;

/**
 * What a public listing adds to a summary: who made it, how many stars it has,
 * and whether the caller is one of them. `starred` is `false` rather than
 * absent for an anonymous caller, so a browse page renders the same control
 * either way.
 */
const communityFields = {
  author: authorSchema,
  stars: z.number().int().nonnegative(),
  starred: z.boolean()
} as const;

/** The immediate parent of a fork, with the link its community page lives at. */
const forkedFromSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    link: z.string().uuid(),
    authorName: z.string()
  })
  .loose()
  .nullable();

export const communityProjectSchema =
  projectSummarySchema.extend(communityFields);

export type CommunityProject = z.infer<typeof communityProjectSchema>;

export const communityComponentSchema =
  componentSummarySchema.extend(communityFields);

export type CommunityComponent = z.infer<typeof communityComponentSchema>;

export const communityProjectPageSchema = pageSchema(communityProjectSchema);
export const communityComponentPageSchema = pageSchema(
  communityComponentSchema
);

export type CommunityProjectPage = z.infer<typeof communityProjectPageSchema>;
export type CommunityComponentPage = z.infer<
  typeof communityComponentPageSchema
>;

/** A public document's own page: the listing entry plus its fork parent. */
export const communityProjectDetailSchema = communityProjectSchema.extend({
  forkedFrom: forkedFromSchema
});

export type CommunityProjectDetail = z.infer<
  typeof communityProjectDetailSchema
>;

export const communityComponentDetailSchema = communityComponentSchema.extend({
  forkedFrom: forkedFromSchema
});

export type CommunityComponentDetail = z.infer<
  typeof communityComponentDetailSchema
>;

/**
 * A public profile. A different shape from `UserResponse` rather than the same
 * one with fields omitted: the address, verification state and credentials are
 * the account holder's business, and nothing here can leak them by accident.
 */
export const publicProfileSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    avatar: z.array(imageVariantSchema).nullable(),
    memberSince: z.string(),
    publicProjects: z.number().int().nonnegative(),
    publicComponents: z.number().int().nonnegative()
  })
  .loose();

export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** Who starred something, for the stargazer list on a detail page. */
export const stargazerPageSchema = pageSchema(authorSchema);

export type StargazerPage = z.infer<typeof stargazerPageSchema>;

/** What a star toggle answers: the new state, and the count it produced. */
export const starResponseSchema = z
  .object({
    starred: z.boolean(),
    stars: z.number().int().nonnegative()
  })
  .loose();

export type StarResponse = z.infer<typeof starResponseSchema>;
