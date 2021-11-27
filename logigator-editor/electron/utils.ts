export function getHomeUrl(): string {
	if (process.env.DEV_MODE) return 'https://dev.logigator.com';
	return 'https://logigator.com';
}

export function getHomeDomain(): string {
	if (process.env.DEV_MODE) return 'dev.logigator.com';
	return 'logigator.com';
}
