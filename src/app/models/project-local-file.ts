import {ProjectModel} from './project-model';
import {ElementType} from './element-types/element-type';

export interface ProjectLocalFile {
	mainProject: {
		name: string;
		id: number,
		data: ProjectModel;
	};
	components: ComponentLocalFile[];
}

export interface ComponentLocalFile {
	typeId: number;
	type: ElementType;
	data: ProjectModel;
}
