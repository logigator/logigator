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
	/**
	 * Additive — `true` when the stored circuit predates the new editor's format.
	 * `false` means it was saved by the new editor (may use features like negated
	 * ports that this editor does not support). Absent on older backends.
	 */
	legacyFormat?: boolean;
}
