import {ProjectsService} from '../../services/projects/projects.service';
import {Element, ElementRotation} from '../element';
import {Type} from '@angular/core';

export interface ElementType {
	id: number;

	// translation id for predefined comps
	name: string;

	category: 'basic' | 'advanced' | 'plug' | 'io' | 'user' | 'local' | 'share';

	symbol: string;
	symbolImage?: string;

	showSettings: boolean;
	showSettingsForType: boolean;
	showInConstructionBox: boolean;

	elementInspectionComp?: Type<any>;

	// translation id for predefined comps
	description: string;

	isRotatable?: boolean;
	rotation: ElementRotation;

	ignoreOutputs?: boolean;
	numOutputs: number;

	numInputs: number;
	minInputs: number;
	maxInputs: number;

	hasPlugIndex?: boolean;
	hasLabel?: boolean;

	width: (element?: Element) => number;
	height: (element?: Element) => number;

	options?: number[];
	optionsConfig?: {
		name: string,
		min?: number,
		max?: number,
		allowedValues?: number[]
	}[];
	onOptionsChanged?: (element?: Element) => void;

	edit?: (typeId: number, id: number, projectsSer: ProjectsService) => void;
	canEditType?: boolean;

	// only used for udcs, order must be like plugIndices
	labels?: string[];
	calcLabels?: (element?: Element) => string[];
}

export function isElementType(object: any): object is ElementType {
	return 'name' in object &&
		'numInputs' in object &&
		'numOutputs' in object &&
		'maxInputs' in object &&
		'minInputs' in object &&
		'symbol' in object &&
		'description' in object &&
		'rotation' in object &&
		'category' in object;
}
