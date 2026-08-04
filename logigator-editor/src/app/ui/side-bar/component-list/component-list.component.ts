import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgAccordion,
  LgAccordionPanel,
  LgBadge,
  LgCard,
  LgIconField,
  LgInputIcon,
  LgInputText
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import { ComponentProviderService } from '../../../components/component-provider.service';
import { ComponentListCategoryComponent } from '../component-list-category/component-list-category.component';
import { ProjectService } from '../../../project/project.service';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../../components/custom/custom-component-registry.service';
import {
  ComponentConfig,
  resolveLocalizableText
} from '../../../components/component-config.model';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';

/** A palette category rendered as one accordion panel. */
interface PaletteCategory {
  /** Stable accordion-panel key. */
  key: string;
  /** Translation key for the category headline. */
  labelKey: TranslationKey;
  /** Components to show, already filtered by the active search. */
  components: ComponentConfig[];
}

@Component({
  selector: 'app-component-list',
  imports: [
    LgInputText,
    FormsModule,
    LgIconField,
    LgInputIcon,
    LgAccordion,
    LgAccordionPanel,
    LgBadge,
    LgCard,
    ComponentListCategoryComponent,
    TranslateDirective
  ],
  templateUrl: './component-list.component.html'
})
export class ComponentListComponent {
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly translation = inject(TranslationService);

  public readonly searchText = signal('');

  private readonly basicComponents =
    this.componentProviderService.basicComponents;
  private readonly advancedComponents =
    this.componentProviderService.advancedComponents;
  private readonly ioComponents = this.componentProviderService.ioComponents;

  /** True while a non-empty search is active. */
  public readonly searchActive = computed(
    () => this.searchText().trim().length > 0
  );

  /**
   * All categories, filtered by the current search. Categories with no matches
   * are dropped so the palette never shows an empty section. The Ports category
   * is only present while editing a component.
   */
  public readonly categories = computed<PaletteCategory[]>(() => {
    const search = this.searchText().trim().toLowerCase();

    const raw: PaletteCategory[] = [
      {
        key: 'basic',
        labelKey: 'components.category.basic',
        components: this.basicComponents()
      },
      {
        key: 'advanced',
        labelKey: 'components.category.advanced',
        components: this.advancedComponents()
      },
      {
        key: 'io',
        labelKey: 'components.category.io',
        components: this.ioComponents()
      }
    ];
    raw.push({
      key: 'user',
      labelKey: 'components.category.user',
      components: this.userComponents()
    });

    return raw
      .map((cat) => ({
        ...cat,
        components: search
          ? cat.components.filter((comp) => this.matches(comp, search))
          : cat.components
      }))
      .filter((cat) => cat.components.length > 0);
  });

  /** Manual expand/collapse state (panel keys), honored when not searching. */
  private readonly manualOpen = signal<string[]>([
    'basic',
    'advanced',
    'io',
    'port',
    'user'
  ]);

  /**
   * Which accordion panels are open: every matching category while searching
   * (auto-expand), otherwise the user's manual state.
   */
  public readonly openPanels = computed(() =>
    this.searchActive()
      ? this.categories().map((cat) => cat.key)
      : this.manualOpen()
  );

  /** Persists manual expand/collapse; ignored while search drives the state. */
  public onPanelChange(
    value: string | number | string[] | number[] | null | undefined
  ): void {
    if (this.searchActive()) return;
    const open = (
      Array.isArray(value) ? value : value != null ? [value] : []
    ).map(String);
    this.manualOpen.set(open);
  }

  /**
   * The palette's user (master) components, newest-edited first and cycle-filtered
   * while editing a component: placing the edited master itself or any master that
   * (transitively) depends on it would close a cycle, so both are excluded.
   */
  public readonly userComponents = computed(() => {
    // A registry save/promotion re-stamps a master and bumps this revision; read
    // it so the ordering below recomputes when a master's `lastEdited` changes.
    this.registry.revision();

    const all = this.componentProviderService.userComponents();
    const active = this.projectService.activeProject();
    const meta = active ? this.metadataStore.getMetadata(active) : undefined;
    const masterTypeId =
      meta?.type === 'comp' && meta.id
        ? this.registry.masterTypeIdForId(meta.id)
        : undefined;

    const visible =
      masterTypeId === undefined
        ? all
        : all.filter(
            (config) => !this.registry.wouldCycle(masterTypeId, config.type)
          );

    return this.sortByLastEdited(visible);
  });

  private matches(config: ComponentConfig, search: string): boolean {
    return this.name(config).toLowerCase().includes(search);
  }

  private name(config: ComponentConfig): string {
    return resolveLocalizableText(config.name, (key) =>
      this.translation.translate(key)
    );
  }

  /**
   * Orders masters by their `lastEdited` time (newest first), falling back to a
   * case-insensitive name compare so equal timestamps stay deterministic. Masters
   * with no recorded timestamp sort last.
   */
  private sortByLastEdited(configs: ComponentConfig[]): ComponentConfig[] {
    return [...configs].sort((a, b) => {
      const ta = this.registry.getDefinition(a.type)?.lastEdited ?? 0;
      const tb = this.registry.getDefinition(b.type)?.lastEdited ?? 0;
      if (tb !== ta) return tb - ta;
      return this.name(a).localeCompare(this.name(b));
    });
  }
}
