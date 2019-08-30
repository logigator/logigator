import {Component} from './component';

export interface ProjectModel {
	id: number;
	board: {
		// links: number
		components: Component[];
	};
}
