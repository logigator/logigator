export interface User {
	username: string;
	email: string;
	image: {
		mimeType: string;
		hash: string;
		publicUrl: string;
	};
}
