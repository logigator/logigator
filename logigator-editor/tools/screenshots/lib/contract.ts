import type * as z from 'zod';
import './runtime.ts';

/**
 * The API's response schemas, loaded from `@logigator/contract`'s source. A
 * mock that answers in a shape the app does not read is the failure this exists
 * to prevent: it produces a capture of an error state, or of nothing at all,
 * and the run reports success.
 *
 * The schemas are the same ones the editor validates its own reads against, so
 * a mock checked against them cannot drift from the client that consumes it.
 */
const { userResponseSchema } =
  await import('../../../../logigator-contract/src/user/user.contract.ts');
const { projectSummarySchema, projectResponseSchema } =
  await import('../../../../logigator-contract/src/document/project.contract.ts');
const { componentSummarySchema, componentResponseSchema } =
  await import('../../../../logigator-contract/src/document/component.contract.ts');

export const SCHEMAS = {
  user: userResponseSchema,
  projectSummary: projectSummarySchema,
  project: projectResponseSchema,
  componentSummary: componentSummarySchema,
  component: componentResponseSchema
};

type Schemas = typeof SCHEMAS;

/** What a fixture of one schema is written as, before parsing fills defaults. */
export type FixtureInput<K extends keyof Schemas> = z.input<Schemas[K]>;

/**
 * Parses one fixture against its schema, so a missing or renamed field fails
 * here with the field named, rather than as a `UserService InvalidResponseError`
 * inside a browser the run has already given up on.
 */
export function fixture<K extends keyof Schemas>(
  name: K,
  value: FixtureInput<K>
): z.output<Schemas[K]> {
  return SCHEMAS[name].parse(value) as z.output<Schemas[K]>;
}
