import {BadRequestError, ExpressErrorMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import {ValidationError} from 'class-validator';
import {FormDataError} from '../../errors/form-data.error';

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
			(error as any).errors.forEach((valErr: ValidationError) => {
				formErrors[formName][valErr.property] = Object.keys(valErr.constraints);
			});
		}

		// FormDataError was thrown somewhere
		if (error.name === 'FormDataError') {
			const formDataError = error as FormDataError;

			if (formDataError.property !== undefined) {
				formErrors[formName][formDataError.property] = [formDataError.errorName];
			} else {
				formErrors[formName].__general__ = [formDataError.errorName];
			}
		}

		/*
			formErrors Format:
				{
					'formName': {
						'formProperty': ['error0', 'error1'],
						'formProperty2': ['error0', 'error1'],
						'formProperty3': ['error1'],
						'formProperty3': ['error1'],
						'__general__': ['error0']
					}
				}
		 */

		request.session.formErrors = formErrors;

		response.redirect(request.get('Referer'));
	}

}
