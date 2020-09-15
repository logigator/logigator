import {BadRequestError, ExpressErrorMiddlewareInterface, HttpError, Middleware} from "routing-controllers";
import {Request, Response} from 'express';
import {ConfigService} from "../services/config.service";

@Middleware({type: "after"})
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {

	private readonly _appContext: string;

	constructor(private configService: ConfigService) {
		this._appContext = this.configService.getConfig('app-context');
	}

	error(error: Error, request: Request, response: Response, next: (err?: any) => any): void {

		let errorResponse: any = {
			status: (error as HttpError).httpCode || 500,
			error: {
				name: error.name || 'InternalServerError',
			}
		}

		if (this._appContext !== 'production') {
			errorResponse.error.description = error.message;
			errorResponse.error.stack = error.stack;
			if (error instanceof BadRequestError && 'errors' in error) {
				errorResponse.error.errors = (error as any).errors;
			}
			console.log(error);
		}

		response.status(errorResponse.status);

		if (request.path.startsWith('/api')) {
			response.setHeader('Content-Type', 'application/json');

			let body: string;
			if (this._appContext !== 'production') {
				body = JSON.stringify(errorResponse, null, 2);
			} else {
				body = JSON.stringify(errorResponse);
			}

			response.send(body);
			return;
		}

		let body = `<h1>${errorResponse.status} ${errorResponse.error.name}</h1><hr>`;
		if (this._appContext !== 'production') {
			console.log(errorResponse.error.stack.split('\n'));

			body += `<h4>${errorResponse.error.description}</h4>`;

			const formattedStack = errorResponse.error.stack.split('\n').map(line => {
				return `${line}<br>`;
			});

			body += `<p>${formattedStack}</p>`
		}
		response.send(body);
	}
}
