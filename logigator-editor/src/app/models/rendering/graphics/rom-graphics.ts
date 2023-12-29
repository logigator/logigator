import { ComponentInspectable } from './l-graphics';
import { ComponentGraphics } from './component-graphics';

export class RomGraphics
	extends ComponentGraphics
	implements ComponentInspectable
{
	onChange: (state: boolean[]) => void;

	public getCurrentSimState(): boolean[] {
		return this.simActiveState;
	}

	public override applySimState(scale: number): boolean {
		if (super.applySimState(scale) && this.onChange) {
			this.onChange(this.simActiveState);
			return true;
		}
		return false;
	}
}
