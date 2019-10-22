import {ProjectModelResponse} from './project-model-response';

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
	data: ProjectModelResponse;
}
