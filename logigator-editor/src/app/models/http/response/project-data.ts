import {ProjectInfo} from './project-info';
import {ComponentInfo} from './component-info';

export interface ProjectData extends ProjectInfo {
	dependencies: ProjectDependency[];
	elements: ProjectElement[];
}

export interface ProjectElement {

	/**
	 * id
	 */
	c: number;

	/**
	 * typeId
	 */
	t: number;

	/**
	 * number of outputs
	 */
	o?: number;

	/**
	 * number of inputs
	 */
	i?: number;

	/**
	 * Position
	 */
	p: number[];

	/**
	 * end-position
	 */
	q?: number[];

	/**
	 * rotation
	 */
	r?: number;

	/**
	 * numerical data
	 */
	n?: number[];

	/**
	 * string data
	 */
	s?: string;

}

export class ProjectDependency {
	dependency: ComponentInfo;
	model: number;
}
