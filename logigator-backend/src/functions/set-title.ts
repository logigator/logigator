import {Response} from 'express';

export function setTitle(response: Response, title: string) {
	response.locals.pageTitle = title;
}
