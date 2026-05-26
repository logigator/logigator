export interface Environment {
	apiUrl: string;
	gridSize: number;
	debug: {
		showGridBorders: boolean;
		showHitboxes: boolean;
		showOrigins: boolean;
		showConnectionPoints: boolean;
		fpsCounter: boolean;
	};
}
