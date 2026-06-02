import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { SelectionInspectorService } from '../../project/selection-inspector.service';
import { ProjectService } from '../../project/project.service';
import { Card } from 'primeng/card';
import {
	LocalizableText,
	resolveLocalizableText
} from '../../components/component-config.model';
import { TranslocoService } from '@jsverse/transloco';

@Component({
	selector: 'app-component-settings',
	imports: [NgComponentOutlet, Card],
	templateUrl: './component-settings.component.html',
	styleUrl: './component-settings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentSettingsComponent {
	private readonly workModeService = inject(WorkModeService);
	private readonly inspector = inject(SelectionInspectorService);
	private readonly projectService = inject(ProjectService);
	private readonly translocoService = inject(TranslocoService);

	// The settings panel shows the placement ghost while placing, otherwise the
	// single selected placed component (R11). The ghost's options are edited
	// directly (the eventual AddComponentsAction captures the final values); a
	// placed component's options are the inspector's proxies, routing writes
	// through ChangeOptionAction (undoable + dirty-tracked). A placed component
	// additionally carries its config's inspector actions + the context they act
	// on; the ghost has none (the buttons are instance-scoped).
	protected readonly componentSettings = computed(() => {
		const ghost = this.workModeService.selectedComponentConfig();
		if (ghost) {
			return {
				name: ghost.name,
				description: ghost.description,
				options: ghost.options,
				actions: [],
				context: null
			};
		}

		const selected = this.inspector.selectedComponent();
		const options = this.inspector.inspectorOptions();
		const project = this.projectService.activeProject();
		if (selected && options && project) {
			return {
				name: selected.config.name,
				description: selected.config.description,
				options,
				actions: selected.config.actions ?? [],
				context: { component: selected, project }
			};
		}

		return null;
	});

	// Inspector-hidden options (e.g. a plug's system-managed `index`) still
	// round-trip through the wire format but are never rendered in the form.
	protected readonly options = computed(() => {
		const settings = this.componentSettings();
		if (!settings) return [];

		return Object.entries(settings.options).filter(
			([, option]) => !option.inspectorHidden
		);
	});

	/** Resolves display text: translates a key, returns a literal verbatim. */
	protected text(value: LocalizableText): string {
		return resolveLocalizableText(value, (key) =>
			this.translocoService.translate(key)
		);
	}
}
