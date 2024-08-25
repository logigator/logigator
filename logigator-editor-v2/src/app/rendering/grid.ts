import { Container, Graphics, Point, Rectangle } from 'pixi.js';
import { GridGraphics } from './graphics/grid.graphics';
import { GraphicsProviderService } from './graphics-provider.service';
import { fromGrid } from '../utils/grid';
import { getStaticDI } from '../utils/get-di';

export class Grid extends Container {
	override sortableChildren = false;

	private readonly _geometryService = getStaticDI(GraphicsProviderService);
	private readonly _chunkSize = 32;
	private readonly _chunkSizePx = fromGrid(this._chunkSize);
	private _elScale = 1;
	private _viewportSize: Point = new Point(0, 0);
	private _elPosition = new Point(0, 0);

	constructor() {
		super();

		this.interactiveChildren = false;

		this.boundsArea = new Rectangle(
			-Number.MAX_VALUE / 2,
			-Number.MAX_VALUE / 2,
			Number.MAX_VALUE,
			Number.MAX_VALUE
		);
		this.hitArea = this.boundsArea;

		this.pivot.set(this._chunkSizePx);
		this.draw();
	}

	public updatePosition(position: Point) {
		this._elPosition.set(position.x, position.y);
		this.position.set(
			-this.chunkAligned(position.x / this._elScale),
			-this.chunkAligned(position.y / this._elScale)
		);
	}

	public resizeViewport(viewport: Point) {
		this._viewportSize.set(viewport.x, viewport.y);
		this.draw();
	}

	public updateScale(scale: number) {
		for (const child of this.children) {
			child.destroy({ children: true });
		}
		this.removeChildren(0);

		this._elScale = scale;
		this.updatePosition(this._elPosition);
		this.draw();
	}

	private draw(): void {
		const geometry = this._geometryService.getGraphicsContext(
			GridGraphics,
			this._chunkSize,
			this._elScale
		);

		const viewportScaled = new Point(
			this._viewportSize.x / this._elScale + this._chunkSizePx,
			this._viewportSize.y / this._elScale + this._chunkSizePx
		);

		let i = 0;
		for (let x = 0; x <= viewportScaled.x; x += this._chunkSizePx) {
			for (let y = 0; y <= viewportScaled.y; y += this._chunkSizePx, ++i) {
				if (this.children.length <= i) {
					const child = new Graphics(geometry);
					child.position.set(x, y);
					this.addChild(child);
				} else {
					this.children[i].position.set(x, y);
				}
			}
		}

		if (i < this.children.length) {
			const indexFromWhichToRemove = i;
			for (; i < this.children.length; ++i) {
				this.children[i].destroy();
			}
			this.removeChildren(indexFromWhichToRemove);
		}
	}

	private chunkAligned(num: number): number {
		return Math.floor(num / this._chunkSizePx) * this._chunkSizePx;
	}
}
