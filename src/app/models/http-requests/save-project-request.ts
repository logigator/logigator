import {ProjectModelResponse} from '../http-responses/project-model-response';

export interface SaveProjectRequest {
	data: ProjectModelResponse;
	num_inputs?: number;
	num_outputs?: number;
}
