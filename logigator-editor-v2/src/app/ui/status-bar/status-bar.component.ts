import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	inject
} from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TranslationKey } from '../../translation/translation-key.model';
import { Point } from 'pixi.js';
import { ComponentProviderService } from '../../components/component-provider.service';
import {
	LocalizableText,
	resolveLocalizableText
} from '../../components/component-config.model';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { ProjectService } from '../../project/project.service';

@Component({
	selector: 'app-status-bar',
	imports: [MenubarModule, TranslocoDirective],
	templateUrl: './status-bar.component.html',
	styleUrl: './status-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBarComponent {
	private readonly workModeService = inject(WorkModeService);
	private readonly componentProviderService = inject(ComponentProviderService);
	private readonly translocoService = inject(TranslocoService);
	private readonly metadataStore = inject(ProjectMetadataStore);
	private readonly projectService = inject(ProjectService);

	public readonly cursorPosition = input<Point>(new Point(0, 0));

	protected readonly dirty = computed(() => {
		const project = this.projectService.mainProject();
		return project ? this.metadataStore.isDirty(project) : false;
	});

	protected readonly boardPositionFormatted = computed(
		() =>
			`${Math.round(this.cursorPosition().x)}, ${Math.round(this.cursorPosition().y)}`
	);

	protected readonly workMode = computed(
		() => `statusBar.modes.${this.workModeService.mode()}` as TranslationKey
	);

	protected readonly selectedComponentName = computed((): LocalizableText => {
		const comp = this.workModeService.selectedComponentType();
		if (comp === null) {
			return { literal: '' };
		}
		return (
			this.componentProviderService.getComponent(comp)?.name ?? { literal: '' }
		);
	});

	/** Resolves display text: translates a key, returns a literal verbatim. */
	protected text(value: LocalizableText): string {
		return resolveLocalizableText(value, (key) =>
			this.translocoService.translate(key)
		);
	}
}
