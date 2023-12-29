import { Response } from './http/response/response';

export interface ApiErrorConfig {
	errorMessage?: string;
	translationParams?: any;
	dynamicMsg?: (err: ApiError) => string;
}

export interface ApiError {
	error: Response<never>;
	ok: boolean;
	status?: number;
	url?: string;
	statusText?: string;
}
