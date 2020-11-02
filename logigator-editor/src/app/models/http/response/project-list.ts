import {ProjectInfo} from './project-info';

export interface ProjectList {
	page: number;
	total: number;
	count: number;
	entries: ProjectInfo[];
}
