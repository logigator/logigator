export interface ApiErrorConfig {
	errorMessage?: string;
	translationParams?: any;
	dynamicMsg?: (err: any) => string;
}
