import {ComponentInfo} from './component-info';
import {ProjectDependency, ProjectElement} from './project-data';

export interface ComponentData extends ComponentInfo {
	dependencies: ProjectDependency[];
	elements: ProjectElement[];
}
