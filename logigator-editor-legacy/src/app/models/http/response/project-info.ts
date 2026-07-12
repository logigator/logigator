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
	 * Additive — `true` when the circuit was saved by the new editor (may use
	 * features like negated ports that this editor does not support). Absent or
	 * `false` means a legacy project. Absent on older backends.
	 */
	newFormat?: boolean;
}
