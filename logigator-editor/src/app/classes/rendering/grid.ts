import { Container, Graphics, Point } from 'pixi.js';
import { GeometryService } from '../../services/geometry/geometry.service';
import { getStaticDI } from '../../utils/get-di';
import { GridGraphics } from './graphics/grid.graphics';
import { fromGrid } from '../../utils/grid';

export class Grid extends Container {
	override sortableChildren = false;

	private readonly _geometryService = getStaticDI(GeometryService);
	private readonly _chunkSize = 32;
	private readonly _chunkSizePx = fromGrid(this._chunkSize);
	private _scale = 1;
	private _viewportSize: Point = new Point(0, 0);
	private _position = new Point(0, 0);

	constructor() {
		super();
		this.pivot.set(this._chunkSizePx);
	}

	public updatePosition(position: Point) {
		this._position.set(position.x, position.y);
		this.position.set(
			-this.chunkAligned(position.x / this._scale),
			-this.chunkAligned(position.y / this._scale)
		);
	}

	public resizeViewport(viewport: Point) {
		this._viewportSize.set(viewport.x, viewport.y);
		this.draw();
	}

	public updateScale(scale: number) {
		for (const child of this.children) {
			child.destroy();
		}
		this.removeChildren(0);

		this._scale = scale;
		this.updatePosition(this._position);
		this.draw();
	}

	private draw(): void {
		const geometry = this._geometryService.getGeometry(
			GridGraphics,
			this._chunkSize,
			this._scale
		);

		const viewportScaled = new Point(
			this._viewportSize.x / this._scale + this._chunkSizePx,
			this._viewportSize.y / this._scale + this._chunkSizePx
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