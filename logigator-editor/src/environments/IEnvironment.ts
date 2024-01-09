export interface IEnvironment {
	production: boolean;
	gridSize: number;
	api: string;
	url: string;
	homeUrl: string;
	debug: {
		showGridBorders: boolean;
	};
}
