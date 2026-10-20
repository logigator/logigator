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
import { ComponentCategory } from '@logigator/core';
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

/** The built-in categories, in palette order; User Components follow them. */
const BUILT_IN_PALETTE_CATEGORIES = [
  ComponentCategory.LOGIC_GATES,
  ComponentCategory.ADDERS_SELECTORS,
  ComponentCategory.MEMORY,
  ComponentCategory.TIMING,
  ComponentCategory.INPUTS,
  ComponentCategory.OUTPUTS
] as const;

/** A palette category rendered as one accordion panel. */
interface PaletteCategory {
  /** Stable accordion-panel key. */
  key: string;
  labelKey: TranslationKey;
  /** Already filtered by the active search. */
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

  public readonly searchActive = computed(
    () => this.searchText().trim().length > 0
  );

  /**
   * All categories, filtered by the current search. Categories with no matches
   * are dropped so the palette never shows an empty section.
   */
  public readonly categories = computed<PaletteCategory[]>(() => {
    const search = this.searchText().trim().toLowerCase();

    const byCategory = this.componentProviderService.componentsByCategory();
    const raw: PaletteCategory[] = BUILT_IN_PALETTE_CATEGORIES.map(
      (category) => ({
        key: category,
        labelKey: `components.category.${category}` as const,
        components: byCategory.get(category) ?? []
      })
    );
    raw.push({
      key: ComponentCategory.USER,
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

  /** Panel keys, honored when not searching. */
  private readonly manualOpen = signal<string[]>([
    ...BUILT_IN_PALETTE_CATEGORIES,
    ComponentCategory.USER
  ]);

  /** Every matching category while searching, otherwise the manual state. */
  public readonly openPanels = computed(() =>
    this.searchActive()
      ? this.categories().map((cat) => cat.key)
      : this.manualOpen()
  );

  /** Ignored while search drives the state. */
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
   * User masters, newest-edited first. While editing a component, the edited
   * master and anything transitively depending on it are excluded: placing
   * either would close a cycle.
   */
  public readonly userComponents = computed(() => {
    // A save or promotion re-stamps a master and bumps this revision; read it
    // so the ordering recomputes when a master's `lastEdited` changes.
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
   * Newest `lastEdited` first, name-compared on ties so the order is
   * deterministic. Masters with no timestamp sort last.
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
