import { Graphics, Point } from 'pixi.js';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { ConnectionPointGraphics } from '../rendering/graphics/connection-point.graphics';
import { environment } from '../../environments/environment';

export class ConnectionPoint extends Graphics {
	private static readonly SCREEN_SIZE_PX = 6;

	private readonly _graphicsProviderService = getStaticDI(GraphicsProviderService);

	constructor(position: Point) {
		super();
		this.interactiveChildren = false;
		this.context = this._graphicsProviderService.getGraphicsContext(ConnectionPointGraphics);
		this.position.copyFrom(position);
		// pivot at (0.5, 0.5) within the 1×1 unit square centres the dot on position
		this.pivot.set(0.5, 0.5);
	}

	public applyScale(scale: number): void {
		const sizeInGridUnits =
			ConnectionPoint.SCREEN_SIZE_PX / (scale * environment.gridSize);
		this.scale.set(sizeInGridUnits);
	}
}
