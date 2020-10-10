import {RenderElement} from '../render-element';
import {ProjectElement} from '../request/api/project-element';

export class Wire extends RenderElement {

	public constructor(element: ProjectElement) {
		super(element.p[0], element.p[1], element.q[0], element.q[1]);
	}

	public render(ctx: CanvasRenderingContext2D, gridSize: number) {
		ctx.beginPath();
		ctx.moveTo(this.x * gridSize, this.y * gridSize);
		ctx.lineTo(this.x2 * gridSize, this.y2 * gridSize);
		ctx.closePath();
		ctx.stroke();
	}
}
