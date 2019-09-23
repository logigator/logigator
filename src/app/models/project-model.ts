import {Element} from './element';

export interface ProjectModel {
	board: {
		// links: number
		elements: Element[];
	};
}
