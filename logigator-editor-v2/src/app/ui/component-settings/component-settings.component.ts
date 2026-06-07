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
import { ChangeOptionAction } from '../../actions/actions/change-option.action';

@Component({
  selector: 'app-component-settings',
  imports: [NgComponentOutlet, Card],
  templateUrl: './component-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentSettingsComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly inspector = inject(SelectionInspectorService);
  private readonly projectService = inject(ProjectService);
  private readonly translocoService = inject(TranslocoService);

  // The settings panel shows the placement ghost while placing, otherwise the
  // single selected placed component (R11). Each branch supplies a `commit`
  // callback that a renderer invokes on edit: the ghost writes its option
  // directly (the eventual AddComponentsAction captures the final values); a
  // placed component routes the write through ChangeOptionAction (undoable +
  // dirty-tracked). A placed component additionally carries its config's
  // inspector actions + the context they act on; the ghost has none (the
  // buttons are instance-scoped).
  protected readonly componentSettings = computed(() => {
    const ghost = this.workModeService.selectedComponentConfig();
    if (ghost) {
      return {
        name: ghost.name,
        description: ghost.description,
        options: ghost.options,
        commit: (key: string, value: unknown) => {
          ghost.options[key].value = value;
        },
        actions: [],
        context: null
      };
    }

    const selected = this.inspector.selectedComponent();
    const project = this.projectService.activeProject();
    if (selected && project) {
      return {
        name: selected.config.name,
        description: selected.config.description,
        options: selected.options,
        commit: (key: string, value: unknown) => {
          const option = selected.options[key];
          if (option.value === value) return;
          project.actionManager.push(
            new ChangeOptionAction(selected.id, key, option.value, value)
          );
        },
        actions: selected.config.actions ?? [],
        context: { component: selected, project }
      };
    }

    return null;
  });

  // Inspector-hidden options (e.g. a plug's system-managed `index`) still
  // round-trip through the wire format but are never rendered in the form.
  // Each row binds the option to its renderer plus a `commit` bound to the
  // option's key, so the renderer reports edits without knowing how they apply.
  protected readonly options = computed(() => {
    const settings = this.componentSettings();
    if (!settings) return [];

    return Object.entries(settings.options)
      .filter(([, option]) => !option.inspectorHidden)
      .map(([key, option]) => ({
        key,
        option,
        commit: (value: unknown) => settings.commit(key, value)
      }));
  });

  /** Resolves display text: translates a key, returns a literal verbatim. */
  protected text(value: LocalizableText): string {
    return resolveLocalizableText(value, (key) =>
      this.translocoService.translate(key)
    );
  }
}
