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
export {
  ApiRequestError,
  InvalidResponseError,
  isApiError
} from './error/api-request-error';
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
  bioSchema,
  emailSchema,
  passwordSchema,
  reduceToUsername,
  usernameSchema,
  websiteUrlSchema,
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
  MAX_SOCIAL_LINKS,
  socialLinkSchema,
  socialPlatformSchema,
  socialUrlSchema,
  type SocialLink
} from './social/social.contract';
export {
  registerRequestSchema,
  registerResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  resendVerificationRequestSchema,
  verifyEmailRequestSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  unlinkGoogleRequestSchema,
  type RegisterRequest,
  type RegisterResponse,
  type LoginRequest,
  type LoginResponse,
  type ResendVerificationRequest,
  type VerifyEmailRequest,
  type RequestPasswordReset,
  type ConfirmPasswordReset,
  type UnlinkGoogleRequest
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
  documentAwaitingCheckSchema,
  documentDependencySchema,
  documentDescriptionSchema,
  documentHiddenSchema,
  documentNameSchema,
  documentVisibilitySchema,
  forkAttributionSchema,
  requireSomeField,
  saveCircuitRequestSchema,
  type Author,
  type CircuitPreview,
  type DocumentDependency,
  type DocumentHidden,
  type DocumentVisibility,
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
  ownedProjectSummarySchema,
  type OwnedProjectSummary,
  type UpdateProjectRequest,
  writtenProjectSummarySchema,
  type WrittenProjectSummary
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
  ownedComponentSummarySchema,
  type OwnedComponentSummary,
  type UpdateComponentRequest,
  writtenComponentSummarySchema,
  type WrittenComponentSummary
} from './document/component.contract';
export {
  NOT_TRANSLATABLE,
  documentTextFields,
  documentTextsResponseSchema,
  documentTextVersionSchema,
  documentTranslationResponseSchema,
  ownerTextFields,
  putDocumentTextRequestSchema,
  siteLanguageSchema,
  textLanguageQuerySchema,
  type DocumentTextsResponse,
  type DocumentTextVersion,
  type DocumentTranslationResponse,
  type PutDocumentTextRequest,
  type TextLanguageQuery
} from './document/document-text.contract';
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
  communityPageQuerySchema,
  communityQuerySchema,
  publicProfileSchema,
  stargazerPageSchema,
  starResponseSchema,
  type CommunityComponent,
  type CommunityComponentDetail,
  type CommunityComponentPage,
  type CommunityProject,
  type CommunityProjectDetail,
  type CommunityPageQuery,
  type CommunityProjectPage,
  type CommunityQuery,
  type PublicProfile,
  type StargazerPage,
  type StarResponse
} from './community/community.contract';
export {
  documentReportReasonSchema,
  reportClientInfoSchema,
  reportDocumentRequestSchema,
  reportDocumentResponseSchema,
  reportErrorRequestSchema,
  reportErrorResponseSchema,
  type DocumentReportReason,
  type ReportClientInfo,
  type ReportDocumentRequest,
  type ReportDocumentResponse,
  type ReportErrorRequest,
  type ReportErrorResponse
} from './report/report.contract';
