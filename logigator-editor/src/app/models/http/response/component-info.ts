export interface ComponentInfo {
	id: string;
	name: string;
	description: string;
	createdOn: string;
	lastEdited: string;
	elementsFile: {
		mimeType: string;
		hash: string;
	};
	symbol: string;
	numInputs: string;
	numOutputs: string;
	labels: string[];
	link: string;
	public: boolean;
}
