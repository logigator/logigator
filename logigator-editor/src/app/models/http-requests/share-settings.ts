export interface CreateShare {
	project: number;
	users?: string[];
	invitations?: boolean;
}

export interface UpdateShare {
	is_public?: boolean;
	users?: string[];
	invitations?: boolean;
}
