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
import { Title } from '@angular/platform-browser';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Point } from 'pixi.js';
import { RouterService } from './routing/router.service';
import { TitleBarComponent } from './ui/title-bar/title-bar.component';
import { ToolBarComponent } from './ui/tool-bar/tool-bar.component';
import { SideBarComponent } from './ui/side-bar/side-bar.component';
import { TabBarComponent } from './ui/tab-bar/tab-bar.component';
import { StatusBarComponent } from './ui/status-bar/status-bar.component';
import { BoardComponent } from './ui/board/board.component';
import { MinimapComponent } from './ui/board/minimap/minimap.component';
import { BugReportBadgeComponent } from './bug-report/bug-report-badge.component';
import { setStaticDIInjector } from './utils/get-di';
import { ComponentSettingsComponent } from './ui/component-settings/component-settings.component';
import { ProjectService } from './project/project.service';
import { PersistenceService } from './persistence/persistence.service';
import { ComponentLibraryService } from './custom-component/component-library.service';
import { EditorSettingsService } from './settings/editor-settings.service';
import { RendererService } from './rendering/renderer.service';
import { UnsavedChangesGuard } from './persistence/unsaved-changes.guard';
import {
  LgConfirmDialog,
  LgConfirmPopup,
  LgDrawer,
  LgToast,
  LgWindowOutlet
} from '@logigator/ui';
import { InspectionService } from './inspection/inspection.service';
import { InspectionSheetComponent } from './inspection/inspection-sheet.component';
import { TranslationService } from './translation/translation.service';
import { WorkMode } from './work-mode/work-mode.enum';
import { WorkModeService } from './work-mode/work-mode.service';
import { LayoutService } from './layout/layout.service';
import { MobileUiService } from './layout/mobile-ui.service';
import { SelectionInspectorService } from './project/selection-inspector.service';
import { ProjectMetadataStore } from './persistence/project-metadata.store';
import { MobileTopBarComponent } from './ui/mobile-top-bar/mobile-top-bar.component';
import { ToolHudComponent } from './ui/tool-hud/tool-hud.component';
import { SelectionActionBarComponent } from './ui/selection-action-bar/selection-action-bar.component';
import { ScissorToggleComponent } from './ui/scissor-toggle/scissor-toggle.component';
import { ZoomFabComponent } from './ui/zoom-fab/zoom-fab.component';
import { MobileStatusComponent } from './ui/mobile-status/mobile-status.component';
import { SimulationControlsComponent } from './ui/simulation-controls/simulation-controls.component';
import { ComponentListComponent } from './ui/side-bar/component-list/component-list.component';
import { PortsPanelComponent } from './ui/ports-panel/ports-panel.component';
import { MobileProjectMenuComponent } from './ui/mobile-menu/mobile-project-menu.component';
import { UserSettingsPanelComponent } from './ui/user-settings/user-settings-panel.component';
import { LoggingService } from './logging/logging.service';
import { ToastService } from './logging/toast.service';
import { SessionLifecycleService } from './user/session-lifecycle.service';
import { ChangelogService } from './changelog/changelog.service';
import { TutorialRunnerService } from './onboarding/tutorial-runner.service';
import { HintService } from './onboarding/hint.service';
import { OnboardingNudgeComponent } from './onboarding/onboarding-nudge.component';
import { OnboardTargetDirective } from './onboarding/onboard-target.directive';
import { AutomationApiService } from './automation/automation-api.service';
import { DebugMenuToggleService } from './ui/debug-menu-toggle.service';
import { TranslateDirective } from './translation/translate.directive';

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
    BugReportBadgeComponent,
    ComponentSettingsComponent,
    LgConfirmPopup,
    LgConfirmDialog,
    LgToast,
    LgDrawer,
    LgWindowOutlet,
    InspectionSheetComponent,
    TranslateDirective,
    MobileTopBarComponent,
    ToolHudComponent,
    SelectionActionBarComponent,
    ScissorToggleComponent,
    ZoomFabComponent,
    MobileStatusComponent,
    SimulationControlsComponent,
    ComponentListComponent,
    PortsPanelComponent,
    MobileProjectMenuComponent,
    UserSettingsPanelComponent,
    OnboardingNudgeComponent,
    OnboardTargetDirective,
    CdkScrollable
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly injector = inject(Injector);
  private readonly routerService = inject(RouterService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly componentLibrary = inject(ComponentLibraryService);
  protected readonly projectService = inject(ProjectService);
  private readonly unsavedChangesGuard = inject(UnsavedChangesGuard);
  // Injected for its side effects: follows the signed-in user from the first
  // cookie read on.
  private readonly sessionLifecycleService = inject(SessionLifecycleService);
  private readonly location = inject(Location);
  private readonly workModeService = inject(WorkModeService);
  private readonly debugMenuToggle = inject(DebugMenuToggleService);
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
  private readonly translation = inject(TranslationService);
  private readonly changelogService = inject(ChangelogService);
  // Injected for its side effects: the runner reacts to the active-tutorial
  // signal, so it must live from startup to drive a nudge-launched run.
  private readonly tutorialRunner = inject(TutorialRunnerService);
  // Injected for its side effects: subscribes to hint triggers from startup.
  private readonly hintService = inject(HintService);
  private readonly title = inject(Title);

  protected readonly cursorPosition = signal<Point>(new Point(0, 0));

  /**
   * @logigator/ui stock labels for the shell's long-lived surfaces. `LG_LABELS`
   * resolves only while a component is constructed, so surfaces alive for the
   * app's whole lifetime bind the inputs instead; `translate()` keeps them live
   * across a language switch.
   */
  protected readonly uiLabels = computed(() => ({
    close: this.translation.translate('common.close'),
    back: this.translation.translate('common.back'),
    dismiss: this.translation.translate('common.dismiss')
  }));

  /** Names the board region the tab strip switches (`aria-controls`). */
  protected readonly boardPanelLabel = computed(() =>
    this.translation.translate('board.panel')
  );

  public readonly isSimulation = computed(
    () => this.workModeService.mode() === WorkMode.SIMULATION
  );

  /** Heads the compact project sheet, mirroring the top bar's title trigger. */
  protected readonly projectName = computed(() => {
    const project = this.projectService.mainProject();
    if (!project) return '';
    return this.metadataStore.getMetadata(project)?.name ?? '';
  });

  /** True while the active tab is a custom-component editor; gates the Ports
   * sheet. */
  protected readonly isEditingComponent = computed(() => {
    const active = this.projectService.activeProject();
    return !!active && this.metadataStore.getMetadata(active)?.type === 'comp';
  });

  constructor() {
    setStaticDIInjector(this.injector);

    // Installed here, not from an app initializer: the facade constructs model
    // objects that resolve their dependencies through the static injector, so
    // it must not be reachable before the line above. Resolved inside the
    // define guard rather than held in an `inject()` field, so that a false
    // AUTOMATION_API drops the module from the bundle (see define.d.ts).
    if (AUTOMATION_API) {
      this.injector.get(AutomationApiService).install();
    }

    // Unconditional, unlike the facade above: the console command's point is
    // reaching a build whose DEBUG_MENU define is false.
    this.debugMenuToggle.install();

    effect(() => {
      const name = this.projectName();
      this.title.setTitle(
        name ? `${name} - Logigator: Editor` : 'Logigator: Editor'
      );
    });

    // The settings sheet opens on demand and never automatically, so close it
    // once its component is deselected rather than leave a blank panel. Other
    // open sheets are left alone.
    effect(() => {
      const selected = this.selectionInspector.selectedComponent();
      if (
        !selected &&
        this.layout.isCompact() &&
        this.mobileUi.activeSheet() === 'settings'
      ) {
        this.mobileUi.close();
      }
    });

    // Aliases first: the browser preload skips records promoted to the cloud,
    // and snapshots embedded before a promotion resolve through the alias.
    // Cloud masters follow the signed-in user, so the session lifecycle owns
    // their preload and teardown.
    void (async () => {
      try {
        await this.componentLibrary.preloadComponentIdAliases();
        await this.componentLibrary.preloadBrowserMasters();
        this.loggingService.info('Editor ready', 'AppComponent');
      } catch (err) {
        this.toastService.warn(
          this.translation.translate('library.loadFailed'),
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

    // The tutorial never auto-starts; its only entry is the first-run nudge.
    this.changelogService.maybeAutoOpen();
  }

  /** A Drawer reporting itself hidden clears the active sheet. */
  protected onSheetClosed(visible: boolean): void {
    if (!visible) this.mobileUi.close();
  }
}
