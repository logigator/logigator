import {ternaryHelper} from './ternary.helper';
import {printIfHelper} from './printif.helper';
import {formNameScopeHelper} from './form-name-scope.helper';
import {concatHelper} from './concat.helper';
import {exprHelper} from './expr.helper';
import {scriptTagHelper} from './scriptTag.helper';
import {styleTagHelper} from './styleTag.helper';
import {formFieldHasErrorsHelper} from './form-field-has-errors.helper';
import {formFieldValueHelper} from './form-field-value.helper';
import {formFieldNameScopeHelper} from './form-field-name-scope.helper';
import {formFieldErrorHelper} from './form-field-error.helper';
import {linkHrefHelper} from './linkHref.helper';
import {infoPopupDataScopeHelper} from './info-popup-data-scope.helper';
import {safeStringHelper} from './safeString.helper';
import {siHelper} from './si.helper';
import {dateHelper} from './date.helper';
import {handelNewLinesHelper} from './handleNewLines';

export const handlebarsHelpers = {
	ternary: ternaryHelper(),
	printIf: printIfHelper(),
	concat: concatHelper(),
	formNameScope: formNameScopeHelper(),
	formFieldNameScope: formFieldNameScopeHelper(),
	formFieldHasErrors: formFieldHasErrorsHelper(),
	formFieldError: formFieldErrorHelper(),
	formFieldValue: formFieldValueHelper(),
	infoPopupDataScope: infoPopupDataScopeHelper(),
	expr: exprHelper(),
	scriptTag: scriptTagHelper(),
	styleTag: styleTagHelper(),
	linkHref: linkHrefHelper(),
	safeString: safeStringHelper(),
	si: siHelper(),
	date: dateHelper(),
	handelNewLines: handelNewLinesHelper()
};
