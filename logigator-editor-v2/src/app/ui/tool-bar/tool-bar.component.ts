import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { ProjectService } from '../../project/project.service';

@Component({
	selector: 'app-tool-bar',
	imports: [ButtonModule, DividerModule, TooltipModule, TranslocoDirective],
	templateUrl: './tool-bar.component.html',
	styleUrl: './tool-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolBarComponent {
	private readonly workModeService = inject(WorkModeService);
	private readonly projectService = inject(ProjectService);

	protected isWireDrawMode = computed(
		() => this.workModeService.mode() === WorkMode.WIRE_DRAWING
	);
	protected isWireConnMode = computed(
		() => this.workModeService.mode() === WorkMode.WIRE_CONNECTION
	);
	protected isSelectMode = computed(
		() => this.workModeService.mode() === WorkMode.SELECT
	);
	protected isSelectExactMode = computed(
		() => this.workModeService.mode() === WorkMode.SELECT_EXACT
	);
	protected isEraseMode = computed(
		() => this.workModeService.mode() === WorkMode.ERASE
	);
	protected isPlaceTextMode = computed(
		() => this.workModeService.mode() === WorkMode.PLACE_TEXT
	);

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

	protected undo(): void {
		this.projectService.activeProject()?.actionManager.undo();
	}

	protected redo(): void {
		this.projectService.activeProject()?.actionManager.redo();
	}

	protected zoomIn(): void {
		this.projectService.activeProject()?.zoomIn();
		this.projectService.activeProject()?.triggerTicker('single');
	}

	protected zoomOut(): void {
		this.projectService.activeProject()?.zoomOut();
		this.projectService.activeProject()?.triggerTicker('single');
	}
}
