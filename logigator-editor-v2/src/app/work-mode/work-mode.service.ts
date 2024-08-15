import { computed, Injectable, signal } from '@angular/core';
import { WorkMode } from './work-mode.enum';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {
	private readonly _mode = signal<WorkMode>(WorkMode.WIRE_DRAWING);
	public readonly mode = computed(this._mode);

	constructor() {}

	public setMode(mode: WorkMode): void {
		this._mode.set(mode);
	}
}
