export interface Tutorial {
	id: string;
	name: string;
	steps: TutorialStep[];
}

export interface TutorialStep {
	title: string;
	text: string;
	elementToExplain?: string;
	explanationBoxLocation?: ExplanationBoxLoc;
}

export const enum ExplanationBoxLoc {
	Top,
	Right,
	Bottom,
	Left
}
