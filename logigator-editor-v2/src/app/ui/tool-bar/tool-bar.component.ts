import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';

@Component({
	selector: 'app-tool-bar',
	standalone: true,
	imports: [ButtonModule, DividerModule, TooltipModule, TranslocoDirective],
	templateUrl: './tool-bar.component.html',
	styleUrl: './tool-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolBarComponent {
	protected drawWireStyles = computed(() =>
		this.workModeService.mode() === WorkMode.WIRE_DRAWING
			? 'bg-bluegray-300'
			: ''
	);
	protected connWireStyles = computed(() =>
		this.workModeService.mode() === WorkMode.WIRE_CONNECTION
			? 'bg-bluegray-300'
			: ''
	);
	protected selectStyles = computed(() =>
		this.workModeService.mode() === WorkMode.SELECT ? 'bg-bluegray-300' : ''
	);
	protected selectExactStyles = computed(() =>
		this.workModeService.mode() === WorkMode.SELECT_EXACT
			? 'bg-bluegray-300'
			: ''
	);
	protected eraseStyles = computed(() =>
		this.workModeService.mode() === WorkMode.ERASE ? 'bg-bluegray-300' : ''
	);
	protected placeTextStyles = computed(() =>
		this.workModeService.mode() === WorkMode.PLACE_TEXT ? 'bg-bluegray-300' : ''
	);

	constructor(private readonly workModeService: WorkModeService) {}

	protected setWireDrawMode(): void {
		this.workModeService.setMode(WorkMode.WIRE_DRAWING);
	}

	protected setWireConnMode(): void {
		this.workModeService.setMode(WorkMode.WIRE_CONNECTION);
	}

	protected setSelectMode(): void {
		this.workModeService.setMode(WorkMode.SELECT);
	}

	protected setSelectExactMode(): void {
		this.workModeService.setMode(WorkMode.SELECT_EXACT);
	}

	protected setEraseMode(): void {
		this.workModeService.setMode(WorkMode.ERASE);
	}

	protected setPlaceTextMode(): void {
		this.workModeService.setMode(WorkMode.PLACE_TEXT);
	}
}
