import { ComponentCategory } from '../component-category.enum';
import { ComponentDef } from '../component-def.model';
import { ComponentType } from '../component-type.enum';

export const andComponentDef: ComponentDef = {
	type: ComponentType.AND,
	name: 'AND Gate',
	symbol: '&',
	description:
		'A AND gate is a digital logic gate that implements logical conjunction. It behaves according to the truth table shown at right. A HIGH output (1) results only if both the inputs to the AND gate are HIGH (1). If neither or only one input to the AND gate is HIGH, a LOW output results.',
	category: ComponentCategory.BASIC
};
