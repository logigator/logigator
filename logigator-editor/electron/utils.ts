export function getApiUrl(): string {
	if (process.env.LOCAL_API) return process.env.LOCAL_API;
	return 'https://logigator.com/aoi';
}
