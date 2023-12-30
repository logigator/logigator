import { ProjectElement } from './http/response/project-data';
import { ComponentInfo } from './http/response/component-info';

export interface ProjectLocalFile {
	project: {
		name: string;
		elements: ProjectElement[];
	};
	components: ComponentLocalFile[];
}

export interface ComponentLocalFile {
	info: Partial<LocalComponentInfo>;
	elements: ProjectElement[];
}

export interface LocalComponentInfo extends Omit<ComponentInfo, 'id'> {
	id: number;
}
