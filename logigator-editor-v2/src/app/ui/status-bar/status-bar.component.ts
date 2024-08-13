import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { NgOptimizedImage } from '@angular/common';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
	selector: 'app-status-bar',
	standalone: true,
	imports: [MenubarModule, NgOptimizedImage, TranslocoDirective],
	templateUrl: './status-bar.component.html',
	styleUrl: './status-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBarComponent {
	constructor(private readonly workModeService: WorkModeService) {}

	public get $workMode() {
		return this.workModeService.mode$;
	}
}
