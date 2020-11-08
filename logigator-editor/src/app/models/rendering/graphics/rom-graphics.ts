import {ComponentInspectable} from './l-graphics';
import {ComponentGraphics} from './component-graphics';

export class RomGraphics extends ComponentGraphics implements ComponentInspectable {

	onChange: (state: boolean[]) => void;

	public getCurrentSimState(): boolean[] {
		return this.simActiveState;
	}

	public applySimState(scale: number) {
		super.applySimState(scale);
		if (this.onChange)
			this.onChange(this.simActiveState);
	}

}
