import {Response, Request} from 'express';
import {Container} from 'typedi';
import {ConfigService} from '../services/config.service';

const sessionMaxAge: number = Container.get(ConfigService).getConfig('session').maxAge;

export function updateAuthenticatedCookie(request: Request, response: Response, isAuthenticated: boolean) {
	request.cookies.isAuthenticated = isAuthenticated;

	response.cookie('isAuthenticated', isAuthenticated, {
		httpOnly: false,
		secure: false,
		maxAge: isAuthenticated ? sessionMaxAge : -10000
	});

}
