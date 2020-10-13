export interface ShareInfo {
	project_id: number;
	address: string;
	is_public: number | boolean;
	users: {
		email: string;
		username: string;
	}[];
}
