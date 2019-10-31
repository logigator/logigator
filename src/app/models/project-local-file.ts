import {ElementType} from './element-types/element-type';
import {Element} from './element';

export interface ProjectLocalFile {
	mainProject: {
		name: string;
		id: number,
		data: Element[];
	};
	components: ComponentLocalFile[];
}

export interface ComponentLocalFile {
	typeId: number;
	type: ElementType;
	data: Element[];
}
