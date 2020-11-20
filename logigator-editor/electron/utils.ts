export function getHomeUrl(): string {
	if (process.env.HOME_URL) return process.env.HOME_URL;
	return 'https://logigator.com';
}

export function getHomeDomain(): string {
	if (process.env.HOME_DOMAIN) return process.env.HOME_DOMAIN;
	return 'logigator.com';
}
