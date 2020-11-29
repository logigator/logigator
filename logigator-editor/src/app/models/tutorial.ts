export interface Tutorial {

	id: string;

	/**
	 * Shown in title of help window
	 */
	name: string;

	steps: TutorialStep[];
}

export interface TutorialStep {

	/**
	 * Overrides the title set in Tutorial
	 */
	title?: string;

	/**
	 * Css selector to a element that should be highlighted
	 */
	elementToHighlight?: string;

	text: string;
}
