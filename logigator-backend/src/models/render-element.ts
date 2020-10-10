export abstract class RenderElement {
	public x: number;
	public y: number;
	public x2: number;
	public y2: number;
	public numInputs: number;
	public numOutputs: number;

	protected constructor(x, y, x2, y2) {
		this.x = x;
		this.y = y;
		this.x2 = x2;
		this.y2 = y2;
	}

	public abstract render(ctx: CanvasRenderingContext2D, gridSize: number, highQuality: boolean);
}
