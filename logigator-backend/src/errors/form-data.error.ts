import {BadRequestError} from 'routing-controllers';

export class FormDataError extends BadRequestError {

	/**
	 * property in form which has the error, undefined if it is an general error
	 */
	property: string | undefined;

	/**
	 * what is the error? ex. email_taken, username_taken
	 */
	errorName: string;

	name = 'FormDataError';

	constructor(property: string | undefined, errorName: string, message?: string) {
		super(message);

		this.property = property;
		this.errorName = errorName;
	}

}
