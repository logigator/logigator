import {ProjectModelResponse} from './project-model-response';
import {OpenProjectResponse} from './open-project-response';

export interface OpenShareResp {
	link: {
		address: string;
		is_public: boolean;
		pk_id: number;
	};
	user: {
		username: string;
		email: string;
	};
	project: {
		id: number;
		name: string;
		description: string;
		symbol: string;
		last_edited: string;
		created_om: string;
		is_component: boolean;
		location: string;
	};
	components: {
		[key: number]: {
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
		}
	};
	data: ProjectModelResponse;
}
