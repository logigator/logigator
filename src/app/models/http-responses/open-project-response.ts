import {ProjectModelResponse} from './project-model-response';

export interface OpenProjectResponse {
	project: {
		created_on: string;
		name: string;
		data: ProjectModelResponse;
		description: string;
		is_component: number;
		last_edited: string;
		symbol: string,
		pk_id: number;
		fk_user: number;
		fk_originates_from: number;
		num_inputs?: number;
		num_outputs?: number;
	};
}
