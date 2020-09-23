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
import {successPopupDataScopeHelper} from './success-popup-data-scope.helper';

export const handlebarsHelpers = {
	ternary: ternaryHelper(),
	printIf: printIfHelper(),
	concat: concatHelper(),
	formNameScope: formNameScopeHelper(),
	formFieldNameScope: formFieldNameScopeHelper(),
	formFieldHasErrors: formFieldHasErrorsHelper(),
	formFieldError: formFieldErrorHelper(),
	formFieldValue: formFieldValueHelper(),
	successPopupDataScope: successPopupDataScopeHelper(),
	expr: exprHelper(),
	scriptTag: scriptTagHelper(),
	styleTag: styleTagHelper(),
	linkHref: linkHrefHelper()
};
