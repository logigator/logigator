// @ts-strict-ignore
import { ProjectInfo } from './project-info';
import { ComponentInfo } from './component-info';
import { ElementRotation } from '../../element-rotation';

export interface ProjectData extends ProjectInfo {
	dependencies: ProjectDependency[];
	elements: ProjectElement[];
}

export interface ProjectElement {
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
	r?: ElementRotation;

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
