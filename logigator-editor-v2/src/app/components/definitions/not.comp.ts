import { ComponentCategory } from '../component-category.enum';
import { ComponentDef } from '../component-def.model';
import { ComponentType } from '../component-type.enum';

export const notComponentDef: ComponentDef = {
	type: ComponentType.NOT,
	name: 'NOT Gate',
	symbol: '!',
	description:
		'A NOT gate is a digital logic gate that implements logical negation. It behaves according to the truth table shown at right. A HIGH output (1) results if the inputs are not equal. If the input is LOW (0), then the output will be HIGH (1).',
	category: ComponentCategory.BASIC
};
