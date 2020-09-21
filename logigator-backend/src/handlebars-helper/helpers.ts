import {ternaryHelper} from './ternary.helper';
import {printIfHelper} from './printif.helper';
import {formNameHelper} from './form-name.helper';
import {concatHelper} from './concat.helper';
import {ifEqualHelper} from './ifEqual.helper';
import {exprHelper} from './expr.helper';
import {scriptTagHelper} from './scriptTag.helper';
import {styleTagHelper} from './styleTag.helper';

export const handlebarsHelpers = {
	ternary: ternaryHelper(),
	printIf: printIfHelper(),
	concat: concatHelper(),
	formName: formNameHelper(),
	ifEqual: ifEqualHelper(),
	expr: exprHelper(),
	scriptTag: scriptTagHelper(),
	styleTag: styleTagHelper()
};
