export interface HttpResponseData<T> {
	status: number;
	result?: T;
	warnings?: any;
	error?: any;
}
