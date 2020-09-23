import {BadRequestError, ExpressErrorMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import {ValidationError} from 'class-validator';
import {FormDataError} from '../../errors/form-data.error';
import {redirect} from '../../functions/redirect';

export class FormErrorMiddleware implements ExpressErrorMiddlewareInterface {

	error(error: any, request: Request, response: Response, next: (err?: any) => any): void {
		if (!(error instanceof BadRequestError && (('errors' in error && 'paramName' in error) || error.name === 'FormDataError'))) {
			throw error;
		}

		const formName = request.path.replace(/\//g, '_').substr(1);

		const formErrors = {};
		formErrors[formName] = {};

		// Validation with class-validator failed
		if ('errors' in error) {
			const currentValues = (error as any).errors[0].target;
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

		redirect(request, response);
	}

}
