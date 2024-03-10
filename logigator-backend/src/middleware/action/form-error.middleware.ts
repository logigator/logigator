import {BadRequestError} from 'routing-controllers';
import {Request, Response} from 'express';
import {ValidationError} from 'class-validator';
import {FormDataError} from '../../errors/form-data.error';
import {redirect} from '../../functions/redirect';

/**
 *
 * @param redirectTargetFunc should return redirect target on error
 */
export function formErrorMiddleware(redirectTargetFunc?: (request: Request, response: Response) => string) {

	return function (error: any, request: Request, response: Response) {
		if (!(error instanceof BadRequestError && (('errors' in error && 'paramName' in error) || error.name === 'FormDataError'))) {
			throw error;
		}

		let formName: string;

		if (error.name === 'FormDataError' && (error as FormDataError).formName) {
			formName = (error as FormDataError).formName;
		} else {
			formName = request.path.replace(/\//g, '_').substr(1);
		}

		const formErrors = {};
		formErrors[formName] = {};

		// Validation with class-validator failed
		if ('errors' in error) {
			const currentValues = request.body;
			Object.keys(currentValues).forEach(key => {
				formErrors[formName][key] = {
					value: currentValues[key]
				};
			});

			(error as any).errors.forEach((valErr: ValidationError) => {
				formErrors[formName][valErr.property].errors = Object.keys(valErr.constraints);
			});
		}

		// FormDataError was thrown somewhere
		if (error.name === 'FormDataError') {
			const formDataError = error as FormDataError;

			const currentValues = formDataError.currentValues;
			Object.keys(currentValues).forEach(key => {
				formErrors[formName][key] = {
					value: currentValues[key]
				};
			});

			if (formDataError.property !== undefined) {
				formErrors[formName][formDataError.property].errors = [formDataError.errorName];
			} else {
				formErrors[formName].__general__ = {
					errors: [formDataError.errorName]
				};
			}
		}

		/*
			formErrors Format:
				{
					'formName': {
						'formProperty': {
							'value': 'val1',
							'errors': ['error0', 'error1']
						},
						'formProperty1': {
							'value': 'val2',
							'errors': ['error0', 'error1']
						},
						'__general__': ['error0']
					}
				}
		 */

		request.session.formErrors = formErrors;

		let redirectTarget;

		if (redirectTargetFunc) {
			redirectTarget = redirectTargetFunc(request, response);
		}

		redirect(request, response, {target: redirectTarget});
	};

}
