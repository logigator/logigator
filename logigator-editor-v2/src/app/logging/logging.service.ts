/* eslint-disable no-console */
import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class LoggingService {
	public error(message: unknown, context: string): void {
		console.error('[%s] %o', context, message);
	}

	public warn(message: unknown, context: string): void {
		console.warn('[%s] %o', context, message);
	}

	public log(message: unknown, context: string): void {
		console.log('[%s] %o', context, message);
	}

	public info(message: unknown, context: string): void {
		console.info('[%s] %o', context, message);
	}

	public debug(message: unknown, context: string): void {
		console.debug('[%s] %o', context, message);
	}
}
