import {ternaryHelper} from './ternary.helper';
import {printIfHelper} from './printif.helper';
import {formNameHelper} from './form-name.helper';
import {concatHelper} from './concat.helper';
import {ifEqualHelper} from './ifEqual.helper';

export const handlebarsHelpers = {
	ternary: ternaryHelper(),
	printIf: printIfHelper(),
	concat: concatHelper(),
	formName: formNameHelper(),
	ifEqual: ifEqualHelper()
};
