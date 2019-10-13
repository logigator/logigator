import { OnBeforeSendHeadersFilter } from 'electron';

export function getApiUrl(): string {
	if (process.env.LOCAL_API) return process.env.LOCAL_API;
	return 'https://api.logigator.com';
}

export function getCookieDomain(): string {
	if (process.env.LOCAL_API) return 'http://localhost:8202';
	return '.logigator.com';
}

export function getHttpFilterRewriteUrl(): OnBeforeSendHeadersFilter {
	return {
		urls: [
			'https://localhost:8202/api/*',
			'http://localhost:8202/api/*'
		]
	};
}

export function getHttpFilterSetCookie(): OnBeforeSendHeadersFilter {
	return {
		urls: [
			'https://api.logigator.com/*',
			'http://api.logigator-local-dev.com/*',
			'https://api.logigator-local-dev.com/*'
		]
	};
}
