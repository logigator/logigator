import {RenderElement} from '../render-element';
import {ProjectElement} from '../request/api/project-element';

export class Not extends RenderElement {

	public constructor(element: ProjectElement) {
		super(element.p[0], element.p[1], element.p[0] + 1, element.p[1] + 2);
	}

	public render(ctx: CanvasRenderingContext2D, gridSize: number) {
		ctx.fillRect(this.x * gridSize, this.y * gridSize, (this.x2 - this.x) * gridSize, (this.y2 - this.y) * gridSize);
		ctx.rect(this.x * gridSize, this.y * gridSize, (this.x2 - this.x) * gridSize, (this.y2 - this.y) * gridSize);
	}
}
