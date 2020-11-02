export interface ProjectInfo {
	id: string;
	name: string;
	description: string;
	createdOn: string;
	lastEdited: string;
	elementsFile: {
		mimeType: string;
		hash: string;
	};
	link: string;
	public: boolean;
}
