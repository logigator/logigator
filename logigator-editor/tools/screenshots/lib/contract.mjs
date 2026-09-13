import { loadContract } from './runtime.mjs';

/**
 * The API's response schemas, loaded from `@logigator/contract`'s source. A
 * mock that answers in a shape the app does not read is the failure this exists
 * to prevent: it produces a capture of an error state, or of nothing at all,
 * and the run reports success.
 *
 * The schemas are the same ones the editor validates its own reads against, so
 * a mock checked against them cannot drift from the client that consumes it.
 */
const { userResponseSchema } = await loadContract('user/user.contract');
const { projectSummarySchema, projectResponseSchema } = await loadContract(
  'document/project.contract'
);
const { componentSummarySchema, componentResponseSchema } = await loadContract(
  'document/component.contract'
);

export const SCHEMAS = {
  user: userResponseSchema,
  projectSummary: projectSummarySchema,
  project: projectResponseSchema,
  componentSummary: componentSummarySchema,
  component: componentResponseSchema
};

/**
 * Parses one fixture against its schema, so a missing or renamed field fails
 * here with the field named, rather than as a `UserService InvalidResponseError`
 * inside a browser the run has already given up on.
 */
export function fixture(name, value) {
  return SCHEMAS[name].parse(value);
}
