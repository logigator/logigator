export interface CreateShare {
	project: number;
	users?: string[];
	invitations?: boolean;
}
