import {ProjectModel} from '../project-model';

export interface OpenProjectResponse {
	project: {
		created_on?: string;
		name: string;
		data: ProjectModel;
		description: string;
		is_component: number;
		last_edited?: string;
		symbol: string,
		pk_id?: number;
		fk_user?: number;
		fk_originates_from?: number;
	};
}
