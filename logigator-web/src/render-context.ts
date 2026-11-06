/** What `server.ts` hands a render as its `REQUEST_CONTEXT`. */
export interface RenderContext {
  cspNonce: string;
  /** The id the server's log names the request by, and the API's log too. */
  requestId: string;
  /** The matched route's template, written by the render once it is known. */
  route?: string;
}

/** The nonce a render was handed, or `null` outside a request. */
export function cspNonceOf(context: unknown): string | null {
  const nonce = (context as Partial<RenderContext> | null)?.cspNonce;
  return typeof nonce === 'string' ? nonce : null;
}

/** The request id a render was handed, or `null` outside a request. */
export function renderRequestId(context: unknown): string | null {
  const id = (context as Partial<RenderContext> | null)?.requestId;
  return typeof id === 'string' ? id : null;
}

/** Notes the route template a render matched in the context it was handed. */
export function recordRenderRoute(context: unknown, route: string): void {
  if (typeof context === 'object' && context !== null) {
    (context as Partial<RenderContext>).route = route;
  }
}
