import { Container, Graphics, Rectangle } from 'pixi.js';
import { GeometryService } from '../../services/geometry/geometry.service';
import { getStaticDI } from '../../utils/get-di';
import { GridGraphics } from './graphics/grid.graphics';
import { fromGrid } from '../../utils/grid';

export class Grid extends Container {
	override sortableChildren = false;

	private readonly _geometryService = getStaticDI(GeometryService);
	private readonly _gridSize = 32;
	private _scale = 1;
	private _viewport: Rectangle = new Rectangle(0, 0, 0, 0);

	constructor() {
		super();
	}

	public updateViewport(viewport: Rectangle) {
		this._viewport.copyFrom(viewport);
		this.draw();
	}

	public updateScale(scale: number) {
		for (const child of this.children) {
			child.destroy();
		}
		this.removeChildren(0);

		this._scale = scale;
		this.draw();
	}

	private draw(): void {
		const geometry = this._geometryService.getGeometry(
			GridGraphics,
			this._gridSize,
			this._scale
		);

		const scaledRight = (this._viewport.width - this._viewport.x) / this._scale;
		const scaledBottom =
			(this._viewport.height - this._viewport.y) / this._scale;
		const step = fromGrid(this._gridSize);

		let i = 0;
		for (
			let x = this.floorToGridSize(-this._viewport.x);
			x < scaledRight;
			x += step
		) {
			for (
				let y = this.floorToGridSize(-this._viewport.y);
				y < scaledBottom;
				y += step
			) {
				const child =
					this.children.length <= i
						? this.addChild(new Graphics(geometry))
						: this.children[i];

				child.position.set(x, y);

				this.children[i++].position.set(x, y);
			}
		}

		if (i < this.children.length) {
			const indexFromWhichToRemove = i;
			for (; i < this.children.length; i++) {
				this.children[i].destroy();
			}
			this.removeChildren(indexFromWhichToRemove);
		}
	}

	private floorToGridSize(value: number) {
		return (
			Math.floor(value / fromGrid(this._gridSize) / this._scale) *
			fromGrid(this._gridSize)
		);
	}
}
