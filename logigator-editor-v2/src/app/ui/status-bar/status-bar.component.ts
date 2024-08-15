import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { NgOptimizedImage } from '@angular/common';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TranslocoDirective } from '@jsverse/transloco';
import { TranslationKey } from '../../translation/translation-key.model';

@Component({
	selector: 'app-status-bar',
	standalone: true,
	imports: [MenubarModule, NgOptimizedImage, TranslocoDirective],
	templateUrl: './status-bar.component.html',
	styleUrl: './status-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBarComponent {
	protected workMode = computed(
		() => `statusBar.modes.${this.workModeService.mode()}` as TranslationKey
	);

	constructor(private readonly workModeService: WorkModeService) {}
}
