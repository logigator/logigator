import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input
} from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { NgOptimizedImage } from '@angular/common';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TranslocoDirective } from '@jsverse/transloco';
import { TranslationKey } from '../../translation/translation-key.model';
import { Point } from 'pixi.js';
import { ComponentProviderService } from '../../components/component-provider.service';

@Component({
	selector: 'app-status-bar',
	standalone: true,
	imports: [MenubarModule, NgOptimizedImage, TranslocoDirective],
	templateUrl: './status-bar.component.html',
	styleUrl: './status-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBarComponent {
	public readonly boardPosition = input<Point>(new Point(0, 0));

	protected readonly boardPositionFormatted = computed(
		() =>
			`${-Math.round(this.boardPosition().x)}, ${-Math.round(this.boardPosition().y)}`
	);

	protected readonly workMode = computed(
		() => `statusBar.modes.${this.workModeService.mode()}` as TranslationKey
	);

	protected readonly selectedComponentName = computed(() => {
		const comp = this.workModeService.selectedComponentType();
		if (comp === null) {
			return '';
		}
		return this.componentProviderService.getComponent(comp).name;
	});

	constructor(
		private readonly workModeService: WorkModeService,
		private readonly componentProviderService: ComponentProviderService
	) {}
}
