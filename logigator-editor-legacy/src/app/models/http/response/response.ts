export interface Response<T> {
	status: number;
	data: T;
	error?: {
		name: string;
		description: string;
	};
}
