import { IEnvironment } from './IEnvironment';

export const environment: IEnvironment = {
	production: true,
	gridSize: 16,
	api: 'https://logigator.com/api',
	url: 'https://logigator.com/editor',
	homeUrl: 'https://logigator.com',
	debug: {
		showGridBorders: false,
		showHitboxes: false
	}
};
