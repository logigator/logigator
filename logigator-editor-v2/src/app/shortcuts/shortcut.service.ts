import { computed, inject, Injectable, OnDestroy, Signal } from '@angular/core';
import {
  fromEvent,
  filter,
  map,
  Observable,
  Subject,
  Subscription
} from 'rxjs';
import { SignalMap } from 'ngxtension/collections';
import { DialogService } from 'primeng/dynamicdialog';
import { TranslocoService } from '@jsverse/transloco';
import {
  ShortcutActionEnum,
  ALL_SHORTCUT_ACTIONS
} from './shortcut-action.enum';
import { DEFAULT_SHORTCUTS, ShortcutBinding } from './shortcut-binding.model';
import { ProjectService } from '../project/project.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ClipboardService } from '../clipboard/clipboard.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { BuiltInComponentType } from '../components/component-type.enum';
import { OpenProjectDialogComponent } from '../ui/open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from '../ui/new-component-dialog/new-component-dialog.component';
import { ToastService } from '../logging/toast.service';

@Injectable({
  providedIn: 'root'
})
export class ShortcutService implements OnDestroy {
  private readonly toastService = inject(ToastService);
  private readonly translocoService = inject(TranslocoService);
  private readonly projectService = inject(ProjectService);
  private readonly persistenceService = inject(PersistenceService);
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
  private readonly STORAGE_KEY = 'logigator.shortcuts';

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
            this._triggered$.next({ action, event: e });
            return;
          }
        }
      });

    this._setupActionHandlers();
  }

  /** Pre-built signal for one action's current binding. Pure lookup — never allocates. */
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
          const oldName = this.translocoService.translate(
            `shortcuts.actions.${existingAction}`
          );
          this.toastService.info(
            this.translocoService.translate('shortcuts.toast.reassignedFrom', {
              action: oldName
            })
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
   * Editing actions (undo/redo/clipboard/tool switches) are gated off while a
   * simulation locks editing; Escape (CANCEL) exits the simulation instead.
   */
  private _editingLocked(): boolean {
    return this.workModeService.mode() === WorkMode.SIMULATION;
  }

  private _setupActionHandlers(): void {
    this.on(ShortcutActionEnum.SAVE).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) void this.persistenceService.saveProject(project);
    });

    this.on(ShortcutActionEnum.OPEN).subscribe(() => {
      this.dialogService.open(OpenProjectDialogComponent, {
        header: this.translocoService.translate('openProjectDialog.title'),
        width: '40rem',
        modal: true,
        closable: true
      });
    });

    this.on(ShortcutActionEnum.NEW_COMPONENT).subscribe(() => {
      this.dialogService.open(NewComponentDialogComponent, {
        header: this.translocoService.translate(
          'titleBar.menuBar.file.items.newComponent.label'
        ),
        width: '28rem',
        modal: true,
        closable: true
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
        project.zoomIn();
      }
    });

    this.on(ShortcutActionEnum.ZOOM_OUT).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) {
        project.zoomOut();
      }
    });

    this.on(ShortcutActionEnum.ZOOM_100).subscribe(() => {
      const project = this.projectService.activeProject();
      if (project) {
        project.zoom100();
      }
    });

    this.on(ShortcutActionEnum.TOOL_WIRE_DRAWING).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.WIRE_DRAWING);
    });

    this.on(ShortcutActionEnum.TOOL_WIRE_CONNECTION).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.WIRE_CONNECTION);
    });

    this.on(ShortcutActionEnum.TOOL_SELECT).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.SELECT);
    });

    this.on(ShortcutActionEnum.TOOL_SELECT_EXACT).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.SELECT_EXACT);
    });

    this.on(ShortcutActionEnum.TOOL_ERASE).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.ERASE);
    });

    this.on(ShortcutActionEnum.TOOL_COMPONENT_PLACEMENT).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
    });

    this.on(ShortcutActionEnum.TOOL_PLACE_TEXT).subscribe(() => {
      if (this._editingLocked()) return;
      this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
      this.workModeService.setSelectedComponentType(BuiltInComponentType.TEXT);
    });
  }

  private _matchesBinding(binding: ShortcutBinding, e: KeyboardEvent): boolean {
    const ctrl = this.isMac ? e.ctrlKey || e.metaKey : e.ctrlKey;
    return (
      e.key === binding.key &&
      ctrl === binding.ctrl &&
      e.shiftKey === binding.shift &&
      e.altKey === binding.alt
    );
  }

  private _bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
    return (
      a.key === b.key &&
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
    } catch {
      /* corrupted data — keep defaults */
      this.toastService.error(
        this.translocoService.translate('shortcuts.toast.loadFailed')
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
    this._triggered$.complete();
  }
}
