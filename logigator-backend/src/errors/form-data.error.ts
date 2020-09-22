import {BadRequestError} from 'routing-controllers';

export class FormDataError extends BadRequestError {

	/**
	 * current values of the form, in must cases you can just use `body`
	 */
	currentValues: any

	/**
	 * property in form which has the error, undefined if it is an general error
	 */
	property: string | undefined;

	/**
	 * what is the error? ex. email_taken, username_taken
	 */
	errorName: string;

	name = 'FormDataError';

	constructor(currentValues: any, property: string | undefined, errorName: string, message?: string) {
		super(message);

		this.currentValues = currentValues;
		this.property = property;
		this.errorName = errorName;
	}

}
