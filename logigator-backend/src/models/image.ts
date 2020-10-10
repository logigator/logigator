import {Point2D} from './point-2d';
import {Canvas, createCanvas} from 'canvas';
import {RenderElement} from './render-element';

export class Image {
	public readonly DEFAULT_GRIDSIZE = 5;

	public readonly size: Point2D;
	public readonly gridSize: number;
	public readonly scaleFactor: number;
	public readonly translate: Point2D;

	public readonly canvas: Canvas;
	public readonly ctx: CanvasRenderingContext2D;

	private lineColor = '#000000';
	private backgroundColor = '#EEEEEE';

	public constructor(elements: RenderElement[], size?: Point2D) {
		let minX = Number.MAX_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER, maxX = 0, maxY = 0;
		for (const element of elements) {
			if (element.x < minX)
				minX = element.x;
			if (element.y < minY)
				minY = element.y;
			if (element.x2 > maxX)
				maxX = element.x2;
			if (element.y2 > maxY)
				maxY = element.y2;
		}

		this.scaleFactor = 1;
		if (size) {
			this.size = size;
			this.gridSize = size.x / (maxX - minX) < size.y / (maxY - minY) ? size.x / (maxX - minX) : size.y / (maxY - minY);
			if (this.gridSize < 2) {
				this.gridSize = 2;
				this.scaleFactor = size.x / (maxX - minX) < size.y / (maxY - minY) ? size.x / (maxX - minX) / 2 : size.y / (maxY - minY) / 2;
			}
		} else {
			this.gridSize = this.DEFAULT_GRIDSIZE;
			this.size = {x: (maxX - minX) * this.gridSize, y: (maxY - minY) * this.gridSize};
		}
		this.translate = {
			x: Math.trunc(-minX * this.gridSize * this.scaleFactor + (this.size.x - (maxX - minX) * this.gridSize * this.scaleFactor) / 2) + 0.5,
			y: Math.trunc(-minY * this.gridSize * this.scaleFactor + (this.size.y - (maxY - minY) * this.gridSize * this.scaleFactor) / 2) + 0.5
		};
		console.log(this.translate);

		this.canvas = createCanvas(this.size.x, this.size.y);
		this.ctx = this.canvas.getContext('2d');
		this.ctx.fillStyle = this.backgroundColor;
		this.ctx.fillRect(0, 0, this.size.x * this.gridSize, this.size.y * this.gridSize);
		this.ctx.translate(this.translate.x + 0.5, this.translate.y + 0.5);
		this.ctx.scale(this.scaleFactor, this.scaleFactor);
		this.ctx.strokeStyle = this.lineColor;

		this.render(elements);
	}

	private render(elements: RenderElement[]) {


		for (const element of elements) {
			element.render(this.ctx, this.gridSize, this.scaleFactor >= 1);
		}
	}
}
