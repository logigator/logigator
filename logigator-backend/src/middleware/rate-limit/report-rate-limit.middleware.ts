import {ExpressMiddlewareInterface, HttpError} from 'routing-controllers';
import {Request, Response} from 'express';
import {Service} from 'typedi';
import {RedisService} from '../../services/redis.service';
import {ConfigService} from '../../services/config.service';

const DEFAULT_WINDOW_SECONDS = 600;
const DEFAULT_MAX_REQUESTS = 5;

/**
 * Fixed-window, per-client rate limit for the unauthenticated error-report
 * endpoint, which can trigger admin emails and large writes. Counts are kept in
 * Redis (so the limit holds across instances) and self-expire after the window.
 *
 * The client is keyed by `X-Forwarded-For` (the app runs behind a proxy; no
 * `trust proxy` is configured, so `request.ip` would be the proxy) falling back
 * to the socket address. If Redis is unavailable the check fails open — a
 * transient cache outage must never swallow error reports.
 */
@Service()
export class ReportRateLimitMiddleware implements ExpressMiddlewareInterface {

	private readonly windowSeconds: number;
	private readonly maxRequests: number;

	constructor(private redisService: RedisService, configService: ConfigService) {
		const environment = configService.getConfig<any>('environment');
		this.windowSeconds = environment.reportRateLimitWindowSeconds ?? DEFAULT_WINDOW_SECONDS;
		this.maxRequests = environment.reportRateLimitMax ?? DEFAULT_MAX_REQUESTS;
	}

	public async use(request: Request, response: Response, next: (err?: any) => any): Promise<void> {
		const key = `ratelimit:report-error:${this.clientIp(request)}`;

		let count: number;
		try {
			count = await this.redisService.increment(key, this.windowSeconds);
		} catch (error) {
			console.error('Report rate-limit check failed; allowing the request.', error);
			next();
			return;
		}

		if (count > this.maxRequests) {
			response.setHeader('Retry-After', String(this.windowSeconds));
			next(new HttpError(429, 'Too many error reports from this client. Please try again later.'));
			return;
		}

		next();
	}

	private clientIp(request: Request): string {
		const forwarded = request.headers['x-forwarded-for'];
		if (typeof forwarded === 'string' && forwarded.length > 0) {
			return forwarded.split(',')[0].trim();
		}
		return request.ip || request.socket.remoteAddress || 'unknown';
	}

}
