import type { LightMyRequestResponse } from 'fastify';

/**
 * Keeps cookies across injected requests, the way a browser would. The session
 * lives in a cookie, so anything spanning two requests needs one of these —
 * passing the header by hand is how a spec asserts on a session it never sent.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  /** Records the `Set-Cookie`s of a response, honouring deletions. */
  store(response: LightMyRequestResponse): void {
    for (const cookie of response.cookies) {
      // A cleared cookie comes back empty with a past expiry; it has to leave
      // the jar, or a logged-out spec keeps sending it.
      if (cookie.value === '') {
        this.cookies.delete(cookie.name);
      } else {
        this.cookies.set(cookie.name, cookie.value);
      }
    }
  }

  /** The `cookie` request header, or undefined when the jar is empty. */
  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  /** Request headers carrying the jar, ready to spread into an injection. */
  headers(): Record<string, string> {
    const cookie = this.header();
    return cookie ? { cookie } : {};
  }
}
