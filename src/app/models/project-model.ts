import {Element} from './element';

export interface ProjectModel {
	id: number;
	board: {
		// links: number
		elements: Element[];
	};
}
