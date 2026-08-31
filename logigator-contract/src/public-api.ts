/**
 * Public surface of `@logigator/contract` — the API contract as zod schemas.
 * The server validates requests with them and clients build typed callers from
 * the inferred types. No codegen, so a contract change breaks every consumer at
 * type-check time; an OpenAPI document may be derived from these schemas, never
 * authored beside them.
 *
 * Layering: the contract may import `@logigator/core`, never the server.
 *
 * zod is imported as `import * as z from 'zod'` everywhere, enforced by the
 * lint fence: the `z` named export is a namespace object carrying every locale
 * table and the JSON-Schema generator, and a bundler can only drop what a
 * schema does not touch when it can see the namespace.
 *
 * Response object schemas are `.loose()`, so a client holding an older contract
 * copy tolerates fields the API added instead of rejecting the response or
 * silently stripping them.
 */
export {
  apiErrorCodeSchema,
  apiErrorSchema,
  isKnownApiErrorCode,
  type ApiError,
  type ApiErrorCode,
  type ApiErrorCodeOrUnknown
} from './error/api-error.contract';
export { metaResponseSchema, type MetaResponse } from './meta/meta.contract';
export {
  imageFormatSchema,
  imageVariantSchema,
  type ImageFormat,
  type ImageVariant
} from './image/image.contract';
export {
  healthCheckSchema,
  readinessResponseSchema,
  type HealthCheck,
  type ReadinessResponse
} from './health/health.contract';
export {
  emailSchema,
  passwordSchema,
  usernameSchema,
  userResponseSchema,
  updateUserRequestSchema,
  updateUserResponseSchema,
  deleteUserRequestSchema,
  type UserResponse,
  type UpdateUserRequest,
  type UpdateUserResponse,
  type DeleteUserRequest
} from './user/user.contract';
export {
  registerRequestSchema,
  registerResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  resendVerificationRequestSchema,
  verifyEmailRequestSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  type RegisterRequest,
  type RegisterResponse,
  type LoginRequest,
  type LoginResponse,
  type ResendVerificationRequest,
  type VerifyEmailRequest,
  type RequestPasswordReset,
  type ConfirmPasswordReset
} from './auth/auth.contract';
export {
  pageQuerySchema,
  pageSchema,
  type Page,
  type PageQuery
} from './page/page.contract';
export {
  authorSchema,
  circuitDocumentInputSchema,
  circuitDocumentSchema,
  circuitFields,
  circuitPreviewSchema,
  componentSymbolSchema,
  documentDependencySchema,
  documentDescriptionSchema,
  documentNameSchema,
  forkAttributionSchema,
  requireSomeField,
  saveCircuitRequestSchema,
  type Author,
  type CircuitPreview,
  type DocumentDependency,
  type ForkAttribution,
  type SaveCircuitRequest
} from './document/document.contract';
export {
  createProjectRequestSchema,
  projectPageSchema,
  projectResponseSchema,
  projectSummarySchema,
  updateProjectRequestSchema,
  type CreateProjectRequest,
  type ProjectPage,
  type ProjectResponse,
  type ProjectSummary,
  type UpdateProjectRequest
} from './document/project.contract';
export {
  componentPageSchema,
  componentResponseSchema,
  componentSummarySchema,
  createComponentRequestSchema,
  updateComponentRequestSchema,
  type ComponentPage,
  type ComponentResponse,
  type ComponentSummary,
  type CreateComponentRequest,
  type UpdateComponentRequest
} from './document/component.contract';
export {
  cloneResponseSchema,
  shareResponseSchema,
  type CloneResponse,
  type ShareResponse
} from './share/share.contract';
export {
  communityComponentDetailSchema,
  communityComponentPageSchema,
  communityComponentSchema,
  communityProjectDetailSchema,
  communityProjectPageSchema,
  communityProjectSchema,
  communityQuerySchema,
  publicProfileSchema,
  stargazerPageSchema,
  starResponseSchema,
  type CommunityComponent,
  type CommunityComponentDetail,
  type CommunityComponentPage,
  type CommunityProject,
  type CommunityProjectDetail,
  type CommunityProjectPage,
  type CommunityQuery,
  type PublicProfile,
  type StargazerPage,
  type StarResponse
} from './community/community.contract';
export {
  reportClientInfoSchema,
  reportErrorRequestSchema,
  reportErrorResponseSchema,
  type ReportClientInfo,
  type ReportErrorRequest,
  type ReportErrorResponse
} from './report/report.contract';
