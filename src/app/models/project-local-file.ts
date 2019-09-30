import {ProjectModel} from './project-model';
import {ElementType} from './element-type';

export interface ProjectLocalFile {
	mainProject: {
		name: string;
		id: number,
		data: ProjectModel;
	};
	components: ComponentLocalFile[];
}

export interface ComponentLocalFile {
	type: ElementType;
	data: ProjectModel;
}
