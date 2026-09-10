import {
  computed,
  inject,
  Injectable,
  OnDestroy,
  Signal,
  signal
} from '@angular/core';
import {
  fromEvent,
  filter,
  map,
  Observable,
  Subject,
  Subscription
} from 'rxjs';
import { SignalMap } from 'ngxtension/collections';
import { DialogService } from '@logigator/ui';
import { DialogId } from '../analytics/analytics.mapping';
import { TranslationService } from '../translation/translation.service';
import {
  ShortcutActionEnum,
  ALL_SHORTCUT_ACTIONS
} from './shortcut-action.enum';
import {
  DEFAULT_SHORTCUTS,
  MODIFIER_FLAG_BY_KEY,
  ShortcutBinding
} from './shortcut-binding.model';
import { ProjectService } from '../project/project.service';
import { SaveCoordinatorService } from '../ui/save-coordinator.service';
import { ClipboardService } from '../clipboard/clipboard.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { BuiltInComponentType } from '@logigator/core';
import { OpenProjectDialogComponent } from '../ui/dialogs/open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from '../ui/dialogs/new-component-dialog/new-component-dialog.component';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';

@Injectable({
  providedIn: 'root'
})
export class ShortcutService implements OnDestroy {
  private readonly toastService = inject(ToastService);
  private readonly loggingService = inject(LoggingService);
  private readonly translation = inject(TranslationService);
  private readonly projectService = inject(ProjectService);
  private readonly saveCoordinator = inject(SaveCoordinatorService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly workModeService = inject(WorkModeService);
  private readonly dialogService = inject(DialogService);

  private readonly _bindings = new SignalMap<
    ShortcutActionEnum,
    ShortcutBinding | null
  >(
    Object.entries(DEFAULT_SHORTCUTS) as [ShortcutActionEnum, ShortcutBinding][]
  );

  private readonly _bindingSignals: Readonly<
    Record<ShortcutActionEnum, Signal<ShortcutBinding | null>>
  >;

  public readonly isMac: boolean = /Mac|iPod|iPhone|iPad/.test(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).userAgentData?.platform ?? navigator.platform
  );

  private _enabled = true;

  private readonly _triggered$ = new Subject<{
    action: ShortcutActionEnum;
    event: KeyboardEvent;
  }>();

  private readonly _keydownSub: Subscription;
  private readonly _holdSubs: Subscription[];
  private readonly STORAGE_KEY = 'logigator.shortcuts';

  // Live keyboard state for hold-style bindings (see isHeld), tracked by
  // KeyboardEvent.key plus modifier flags, so a binding rebound to a plain
  // letter works like the default bare 'Alt'.
  private readonly _heldKeys = new Set<string>();
  private _heldCtrl = false;
  private _heldShift = false;
  private _heldAlt = false;
  private readonly _heldChange$ = new Subject<void>();
  // Reactive mirror of the held-key state, so {@link isHeld} read inside a
  // template or computed re-evaluates under zoneless change detection.
  private readonly _heldVersion = signal(0);

  /**
   * Fires after every held-key state change (keydown, keyup, window blur), so
   * an in-flight gesture can re-poll {@link isHeld} without waiting for the
   * next pointer event.
   */
  public readonly heldChange$: Observable<void> =
    this._heldChange$.asObservable();

  constructor() {
    this._bindingSignals = Object.fromEntries(
      ALL_SHORTCUT_ACTIONS.map((a) => [
        a,
        computed(() => {
          const b = this._bindings.get(a);
          return b !== undefined ? b : DEFAULT_SHORTCUTS[a];
        })
      ])
    ) as Record<ShortcutActionEnum, Signal<ShortcutBinding | null>>;

    this._loadFromStorage();

    this._keydownSub = fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(
        filter(
          (e) =>
            this._enabled &&
            (e.key === 'Escape' || !this._isInputTarget(e.target))
        )
      )
      .subscribe((e) => {
        for (const [action, binding] of this._bindings.entries()) {
          if (binding && this._matchesBinding(binding, e)) {
            e.preventDefault();
            this.loggingService.debug(
              'Shortcut action fired: ' + action,
              'ShortcutService'
            );
            this._triggered$.next({ action, event: e });
            return;
          }
        }
      });

    this._holdSubs = [
      fromEvent<KeyboardEvent>(window, 'keydown').subscribe((e) => {
        this._heldKeys.add(e.key);
        this._trackModifiers(e);
        this._notifyHeldChange();
      }),
      fromEvent<KeyboardEvent>(window, 'keyup').subscribe((e) => {
        this._heldKeys.delete(e.key);
        this._trackModifiers(e);
        this._notifyHeldChange();
      }),
      // A keyup delivered to another window (alt-tab) would leave keys stuck
      // held, so a focus loss releases everything.
      fromEvent(window, 'blur').subscribe(() => {
        this._heldKeys.clear();
        this._heldCtrl = false;
        this._heldShift = false;
        this._heldAlt = false;
        this._notifyHeldChange();
      })
    ];

    this._setupActionHandlers();
  }

  /**
   * Whether the action's binding is physically held right now. For hold-style
   * bindings `on()` fires once at keydown; this reports the live state for the
   * duration of a pointer gesture.
   */
  public isHeld(action: ShortcutActionEnum): boolean {
    // Track the reactive mirror so a template/computed read re-evaluates on
    // key changes; a non-reactive gesture poll ignores it.
    this._heldVersion();
    const binding = this._bindingSignals[action]();
    if (!binding) return false;
    // A bare-modifier binding keeps its own flag false (it would display as
    // "Alt + Alt"), so skip that flag; the held key already proves it.
    const own = MODIFIER_FLAG_BY_KEY[binding.key];
    return (
      this._heldKeys.has(binding.key) &&
      (own === 'ctrl' || this._heldCtrl === binding.ctrl) &&
      (own === 'shift' || this._heldShift === binding.shift) &&
      (own === 'alt' || this._heldAlt === binding.alt)
    );
  }

  private _notifyHeldChange(): void {
    this._heldVersion.update((v) => v + 1);
    this._heldChange$.next();
  }

  private _trackModifiers(e: KeyboardEvent): void {
    this._heldCtrl = this.isMac ? e.ctrlKey || e.metaKey : e.ctrlKey;
    this._heldShift = e.shiftKey;
    this._heldAlt = e.altKey;
  }

  /** Pre-built signal for one action's current binding; never allocates. */
  public binding(action: ShortcutActionEnum): Signal<ShortcutBinding | null> {
    return this._bindingSignals[action];
  }

  /** Observable that emits the KeyboardEvent whenever `action` is triggered. */
  public on(action: ShortcutActionEnum): Observable<KeyboardEvent> {
    return this._triggered$.pipe(
      filter((e) => e.action === action),
      map((e) => e.event)
    );
  }

  public enable(): void {
    this._enabled = true;
  }

  public disable(): void {
    this._enabled = false;
  }

  public setBinding(
    action: ShortcutActionEnum,
    binding: ShortcutBinding | null
  ): void {
    if (binding) {
      for (const [
        existingAction,
        existingBinding
      ] of this._bindings.entries()) {
        if (
          existingAction !== action &&
          existingBinding &&
          this._bindingsEqual(existingBinding, binding)
        ) {
          this._bindings.set(existingAction, null);
          const oldName = this.translation.translate(
            `shortcuts.actions.${existingAction}`
          );
          this.toastService.info(
            this.translation.translate('shortcuts.toast.reassignedFrom', {
              action: oldName
            }),
            'ShortcutService'
          );
          break;
        }
      }
    }
    this._bindings.set(action, binding);
    this._saveToStorage();
  }

  public resetBinding(action: ShortcutActionEnum): void {
    this._bindings.set(action, DEFAULT_SHORTCUTS[action]);
    this._saveToStorage();
  }

  public resetAll(): void {
    for (const action of ALL_SHORTCUT_ACTIONS) {
      this._bindings.set(action, DEFAULT_SHORTCUTS[action]);
    }
    this._saveToStorage();
  }

  /**
   * Editing actions (undo/redo/clipboard) are gated off while a simulation
   * locks editing; Escape exits the simulation instead. Tool switches need no
   * gate, since `WorkModeService.setMode` ignores them itself.
   */
  private _editingLocked(): boolean {
    return this.workModeService.mode() === WorkMode.SIMULATION;
  }

  private _setupActionHandlers(): void {
    this.on(ShortcutActionEnum.SAVE).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) void this.saveCoordinator.requestSave(project);
    });

    this.on(ShortcutActionEnum.OPEN).subscribe(() => {
      this.dialogService.open(OpenProjectDialogComponent, {
        header: this.translation.translate('openProjectDialog.title'),
        width: '40rem',
        modal: true,
        closable: true,
        telemetryId: DialogId.OpenProject
      });
    });

    this.on(ShortcutActionEnum.NEW_COMPONENT).subscribe(() => {
      this.dialogService.open(NewComponentDialogComponent, {
        header: this.translation.translate(
          'titleBar.menuBar.file.items.newComponent.label'
        ),
        width: '28rem',
        modal: true,
        closable: true,
        telemetryId: DialogId.NewComponent
      });
    });

    this.on(ShortcutActionEnum.UNDO).subscribe(() => {
      if (this._editingLocked()) return;
      this.projectService.activeProject()?.actionManager.undo();
    });

    this.on(ShortcutActionEnum.REDO).subscribe(() => {
      if (this._editingLocked()) return;
      this.projectService.activeProject()?.actionManager.redo();
    });

    this.on(ShortcutActionEnum.COPY).subscribe(() => {
      if (this._editingLocked()) return;
      const project = this.projectService.activeProject();
      if (project) this.clipboardService.copy(project);
    });

    this.on(ShortcutActionEnum.CUT).subscribe(() => {
      if (this._editingLocked()) return;
      const project = this.projectService.activeProject();
      if (project) this.clipboardService.cut(project);
    });

    this.on(ShortcutActionEnum.PASTE).subscribe(() => {
      if (this._editingLocked()) return;
      const project = this.projectService.activeProject();
      if (project) this.clipboardService.paste(project);
    });

    this.on(ShortcutActionEnum.DELETE).subscribe(() => {
      if (this._editingLocked()) return;
      const project = this.projectService.activeProject();
      if (project) this.clipboardService.delete(project);
    });

    this.on(ShortcutActionEnum.ZOOM_IN).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) {
        project.viewport.zoomIn();
      }
    });

    this.on(ShortcutActionEnum.ZOOM_OUT).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) {
        project.viewport.zoomOut();
      }
    });

    this.on(ShortcutActionEnum.ZOOM_100).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) {
        project.viewport.zoom100();
      }
    });

    this.on(ShortcutActionEnum.TOOL_PAN).subscribe(() => {
      this.workModeService.setMode(WorkMode.PAN);
    });

    this.on(ShortcutActionEnum.TOOL_WIRE).subscribe(() => {
      this.workModeService.setMode(WorkMode.WIRE_TOOL);
    });

    this.on(ShortcutActionEnum.TOOL_SELECT).subscribe(() => {
      this.workModeService.setMode(WorkMode.SELECT);
    });

    // SELECT_SCISSOR has no trigger handler: it is a hold-style binding
    // queried via isHeld() during a select drag. The keydown match still
    // preventDefaults, which keeps a bare Alt from focusing the browser menu.

    this.on(ShortcutActionEnum.TOOL_ERASE).subscribe(() => {
      this.workModeService.setMode(WorkMode.ERASE);
    });

    this.on(ShortcutActionEnum.TOOL_PLACE_TEXT).subscribe(() => {
      this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
      this.workModeService.setSelectedComponentType(BuiltInComponentType.TEXT);
    });
  }

  private _matchesBinding(binding: ShortcutBinding, e: KeyboardEvent): boolean {
    const ctrl = this.isMac ? e.ctrlKey || e.metaKey : e.ctrlKey;
    // Skip the flag a bare-modifier binding's own key sets: pressing Alt
    // reports altKey=true, but the binding stores alt=false to display "Alt".
    const own = MODIFIER_FLAG_BY_KEY[binding.key];
    return (
      this._keysEqual(e.key, binding.key) &&
      (own === 'ctrl' || ctrl === binding.ctrl) &&
      (own === 'shift' || e.shiftKey === binding.shift) &&
      (own === 'alt' || e.altKey === binding.alt)
    );
  }

  /**
   * Character keys compare case-insensitively: a held Shift reports the shifted
   * character, so a shifted binding stored lowercase would never match. The
   * shift flag keeps shifted and unshifted bindings distinct.
   */
  private _keysEqual(a: string, b: string): boolean {
    if (a.length === 1 && b.length === 1) {
      return a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  }

  private _bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
    return (
      this._keysEqual(a.key, b.key) &&
      a.ctrl === b.ctrl &&
      a.shift === b.shift &&
      a.alt === b.alt
    );
  }

  private _isInputTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    return (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
  }

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed: Record<string, ShortcutBinding | null> = JSON.parse(raw);
      for (const [action, binding] of Object.entries(parsed)) {
        if ((Object.values(ShortcutActionEnum) as string[]).includes(action)) {
          this._bindings.set(action as ShortcutActionEnum, binding);
        }
      }
    } catch (err) {
      /* corrupted data — keep defaults */
      this.toastService.error(
        this.translation.translate('shortcuts.toast.loadFailed'),
        'ShortcutService',
        err
      );
    }
  }

  private _saveToStorage(): void {
    const obj: Record<string, ShortcutBinding | null> = {};
    for (const [action, binding] of this._bindings.entries()) {
      obj[action] = binding;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
  }

  ngOnDestroy(): void {
    this._keydownSub.unsubscribe();
    for (const sub of this._holdSubs) sub.unsubscribe();
    this._triggered$.complete();
  }
}
