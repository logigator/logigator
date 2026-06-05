import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ComponentProviderService } from '../../components/component-provider.service';
import { ComponentListComponent } from './component-list/component-list.component';
import { PortsPanelComponent } from '../ports-panel/ports-panel.component';
import { TranslocoDirective } from '@jsverse/transloco';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';

@Component({
  selector: 'app-side-bar',
  imports: [
    InputTextModule,
    FormsModule,
    IconFieldModule,
    InputIconModule,
    ComponentListComponent,
    PortsPanelComponent,
    TranslocoDirective
  ],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideBarComponent {
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly registry = inject(CustomComponentRegistry);

  public searchText = '';

  public readonly basicComponents =
    this.componentProviderService.basicComponents;
  public readonly advancedComponents =
    this.componentProviderService.advancedComponents;
  public readonly ioComponents = this.componentProviderService.ioComponents;

  /** True while the active tab is a custom-component editor (`type: 'comp'`). */
  public readonly isEditingComponent = computed(() => {
    const active = this.projectService.activeProject();
    return !!active && this.metadataStore.getMetadata(active)?.type === 'comp';
  });

  /**
   * The palette's user (master) components, cycle-filtered while editing a
   * component: placing the edited master itself or any master that (transitively)
   * depends on it would close a cycle, so both are excluded ([§H]).
   */
  public readonly userComponents = computed(() => {
    const all = this.componentProviderService.userComponents();
    const active = this.projectService.activeProject();
    const meta = active ? this.metadataStore.getMetadata(active) : undefined;
    if (meta?.type !== 'comp' || !meta.id) return all;

    const masterTypeId = this.registry.masterTypeIdForId(meta.id);
    if (masterTypeId === undefined) return all;

    return all.filter(
      (config) => !this.registry.wouldCycle(masterTypeId, config.type)
    );
  });
}
