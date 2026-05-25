import { Project } from '../project';
import { ComponentInspectable } from './graphics/l-graphics';

export interface WindowWorkAreaMeta {
	project?: Project;
	sprite?: ComponentInspectable;
	identifier?: string;
	showing?: boolean;
	zIndex?: number;
	parentNames?: string[];
	parentTypesIds?: number[];
}
