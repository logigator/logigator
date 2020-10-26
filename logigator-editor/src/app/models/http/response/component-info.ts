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
	numInputs: number;
	numOutputs: number;
	labels: string[];
	link: string;
	public: boolean;
}
