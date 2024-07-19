import { IEnvironment } from './IEnvironment';

export const environment: IEnvironment = {
	production: false,
	gridSize: 16,
	api: 'http://dev.logigator.com/api',
	url: 'http://dev.logigator.com/editor',
	homeUrl: 'http://dev.logigator.com',
	debug: {
		showGridBorders: true,
		showHitboxes: true,
		showOrigins: true,
		showConnectionPoints: true
	}
};
