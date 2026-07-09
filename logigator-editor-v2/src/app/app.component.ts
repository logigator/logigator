import 'pixi.js/math-extras';

import {
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal
} from '@angular/core';
import { Location } from '@angular/common';
import { Point } from 'pixi.js';
import { RouterService } from './routing/router.service';
import { TitleBarComponent } from './ui/title-bar/title-bar.component';
import { ToolBarComponent } from './ui/tool-bar/tool-bar.component';
import { SideBarComponent } from './ui/side-bar/side-bar.component';
import { TabBarComponent } from './ui/tab-bar/tab-bar.component';
import { StatusBarComponent } from './ui/status-bar/status-bar.component';
import { BoardComponent } from './ui/board/board.component';
import { MinimapComponent } from './ui/board/minimap/minimap.component';
import { setStaticDIInjector } from './utils/get-di';
import { ComponentSettingsComponent } from './ui/component-settings/component-settings.component';
import { ProjectService } from './project/project.service';
import { PersistenceService } from './persistence/persistence.service';
import { EditorSettingsService } from './settings/editor-settings.service';
import { RendererService } from './rendering/renderer.service';
import { UnsavedChangesGuard } from './persistence/unsaved-changes.guard';
import {
  LgConfirmDialog,
  LgConfirmPopup,
  LgDrawer,
  LgPanelMenu,
  LgToast,
  LgWindowOutlet
} from '@logigator/ui';
import { InspectionService } from './inspection/inspection.service';
import { InspectionSheetComponent } from './inspection/inspection-sheet.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WorkMode } from './work-mode/work-mode.enum';
import { WorkModeService } from './work-mode/work-mode.service';
import { LayoutService } from './layout/layout.service';
import { MobileUiService } from './layout/mobile-ui.service';
import { EditorMenuService } from './ui/editor-menu.service';
import { SelectionInspectorService } from './project/selection-inspector.service';
import { ProjectMetadataStore } from './persistence/project-metadata.store';
import { Component as CircuitComponent } from './components/component';
import { MobileTopBarComponent } from './ui/mobile-top-bar/mobile-top-bar.component';
import { ToolHudComponent } from './ui/tool-hud/tool-hud.component';
import { SelectionActionBarComponent } from './ui/selection-action-bar/selection-action-bar.component';
import { ZoomFabComponent } from './ui/zoom-fab/zoom-fab.component';
import { MobileStatusComponent } from './ui/mobile-status/mobile-status.component';
import { SimulationControlsComponent } from './ui/simulation-controls/simulation-controls.component';
import { ComponentListComponent } from './ui/side-bar/component-list/component-list.component';
import { PortsPanelComponent } from './ui/ports-panel/ports-panel.component';
import { UserSettingsComponent } from './ui/user-settings/user-settings.component';
import { LoggingService } from './logging/logging.service';
import { ToastService } from './logging/toast.service';
import { SessionLifecycleService } from './user/session-lifecycle.service';

@Component({
  selector: 'app-root',
  imports: [
    TitleBarComponent,
    ToolBarComponent,
    SideBarComponent,
    TabBarComponent,
    StatusBarComponent,
    BoardComponent,
    MinimapComponent,
    ComponentSettingsComponent,
    LgConfirmPopup,
    LgConfirmDialog,
    LgToast,
    LgDrawer,
    LgPanelMenu,
    LgWindowOutlet,
    InspectionSheetComponent,
    TranslocoDirective,
    MobileTopBarComponent,
    ToolHudComponent,
    SelectionActionBarComponent,
    ZoomFabComponent,
    MobileStatusComponent,
    SimulationControlsComponent,
    ComponentListComponent,
    PortsPanelComponent,
    UserSettingsComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly injector = inject(Injector);
  private readonly routerService = inject(RouterService);
  private readonly persistenceService = inject(PersistenceService);
  protected readonly projectService = inject(ProjectService);
  private readonly unsavedChangesGuard = inject(UnsavedChangesGuard);
  // Injected for its side effects: follows the signed-in user (cloud library
  // load/clear, logout teardown) from the first cookie read on.
  private readonly sessionLifecycleService = inject(SessionLifecycleService);
  private readonly location = inject(Location);
  private readonly workModeService = inject(WorkModeService);
  protected readonly layout = inject(LayoutService);
  protected readonly mobileUi = inject(MobileUiService);
  protected readonly editorSettings = inject(EditorSettingsService);
  protected readonly rendererService = inject(RendererService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly selectionInspector = inject(SelectionInspectorService);
  // Injected for its side effects: nothing renders it, but it must live from
  // startup to catch the first simulation session's inspect taps.
  private readonly inspectionService = inject(InspectionService);
  private readonly loggingService = inject(LoggingService);
  private readonly toastService = inject(ToastService);
  private readonly translocoService = inject(TranslocoService);

  protected readonly cursorPosition = signal<Point>(new Point(0, 0));

  protected readonly menuItems = inject(EditorMenuService).items;

  public readonly isSimulation = computed(
    () => this.workModeService.mode() === WorkMode.SIMULATION
  );

  /** True while the active tab is a custom-component editor — gates the Ports sheet. */
  protected readonly isEditingComponent = computed(() => {
    const active = this.projectService.activeProject();
    return !!active && this.metadataStore.getMetadata(active)?.type === 'comp';
  });

  // Opens the settings sheet on mobile when a component becomes selected (the
  // only door to it) and closes it again when the selection goes away so it
  // never lingers as a blank panel. Suppressed during placement (a modal sheet
  // would block tap-to-place — see plan §6.2). Reacts only to selection
  // *transitions* so opening another sheet while a component stays selected
  // doesn't yank the user back to settings.
  private _prevSelected: CircuitComponent | null = null;

  constructor() {
    setStaticDIInjector(this.injector);

    effect(() => {
      const selected = this.selectionInspector.selectedComponent();
      const compact = this.layout.isCompact();
      const placing =
        this.workModeService.mode() === WorkMode.COMPONENT_PLACEMENT;
      const prev = this._prevSelected;
      this._prevSelected = selected;
      if (!compact) return;
      if (selected && selected !== prev && !placing) {
        this.mobileUi.open('settings');
      } else if (
        !selected &&
        prev &&
        this.mobileUi.activeSheet() === 'settings'
      ) {
        // The selection that opened the settings sheet is gone (e.g. opening
        // the component editor switched tabs), so the sheet would only show a
        // blank panel — close it. Guarded to the settings sheet so a different
        // open sheet is left alone.
        this.mobileUi.close();
      }
    });

    // Load promotion aliases first: the browser preload skips records whose id
    // was promoted to the cloud, and snapshots embedded before a promotion
    // resolve through the alias — both need the alias map in place. Cloud
    // masters are not loaded here: they follow the signed-in user, so the
    // session lifecycle owns their preload (and teardown).
    void (async () => {
      try {
        await this.persistenceService.preloadComponentIdAliases();
        await this.persistenceService.preloadBrowserMasters();
        this.loggingService.info('Editor ready', 'AppComponent');
      } catch (err) {
        this.toastService.warn(
          this.translocoService.translate('library.loadFailed'),
          'AppComponent',
          err
        );
      }
    })();

    if (!this.routerService.matches(this.location.path())) {
      this.persistenceService.createAndSetEmptyProject();
    }

    void this.routerService.processCurrentRoute();

    this.unsavedChangesGuard.attach();
  }

  /** A Drawer reporting itself hidden (mask click / Esc) clears the active sheet. */
  protected onSheetClosed(visible: boolean): void {
    if (!visible) this.mobileUi.close();
  }
}
