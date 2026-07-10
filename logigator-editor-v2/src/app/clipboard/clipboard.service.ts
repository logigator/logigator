import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SerializedComponent } from '../components/serialized-component.model';
import { SerializedWire } from '../wires/serialized-wire.model';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ActionContainer } from '../actions/action-container';
import { RemoveComponentsAction } from '../actions/actions/remove-components.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { ComponentProviderService } from '../components/component-provider.service';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';

const PASTE_OFFSET = 2;

interface ClipboardData {
  components: SerializedComponent[];
  wires: SerializedWire[];
}

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly logging = inject(LoggingService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  private _clipboard: ClipboardData | null = null;

  public get hasClipboard(): boolean {
    return this._clipboard !== null;
  }

  public copy(project: Project): void {
    const sm = project.selectionManager;
    if (sm.isEmpty) {
      return;
    }
    this._clipboard = {
      components: [...sm.selectedComponents].map((c) => Component.serialize(c)),
      wires: [...sm.selectedWires].map((w) => Wire.serialize(w))
    };
    this.logging.debug(
      `copy serialized ${this._clipboard.components.length} component(s), ${this._clipboard.wires.length} wire(s)`,
      'ClipboardService'
    );
  }

  public cut(project: Project): void {
    if (project.selectionManager.isEmpty) {
      return;
    }
    this.copy(project);
    this._applyDelete(project);
  }

  public delete(project: Project): void {
    if (project.selectionManager.isEmpty) return;
    this._applyDelete(project);
  }

  public paste(project: Project): void {
    if (!this._clipboard) {
      return;
    }
    const { components, wires } = this._clipboard;
    const provider = getStaticDI(ComponentProviderService);

    const freshComponents: Component[] = [];
    for (const s of components) {
      const config = provider.getComponent(s.type);
      if (!config) continue;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, type: _type, pos, ...rest } = s;
      freshComponents.push(
        Component.deserialize(
          { ...rest, pos: [pos[0] + PASTE_OFFSET, pos[1] + PASTE_OFFSET] },
          config
        )
      );
    }

    const freshWires: Wire[] = wires.map((w) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, pos, ...rest } = w;
      return Wire.deserialize({
        ...rest,
        pos: [pos[0] + PASTE_OFFSET, pos[1] + PASTE_OFFSET]
      });
    });

    this.logging.debug(
      `paste created ${freshComponents.length} component(s), ${freshWires.length} wire(s)`,
      'ClipboardService'
    );

    // A clipboard component whose type is no longer registered is skipped
    const skipped = components.length - freshComponents.length;
    if (skipped > 0) {
      this.toast.warn(
        this.transloco.translate('clipboard.pastePartial'),
        'ClipboardService'
      );
    }

    project.startPasteSession(freshComponents, freshWires);
  }

  private _applyDelete(project: Project): void {
    const sm = project.selectionManager;

    // Snapshot before any mutation — evict() modifies these Sets
    const components = [...sm.selectedComponents];
    const wires = [...sm.selectedWires];

    // Fold any pending scissor cut into the same undo step
    const container = sm.claimPendingCut() ?? new ActionContainer();

    // Serialize before removal — constructors capture positions eagerly
    if (components.length > 0)
      container.add(new RemoveComponentsAction(...components));
    if (wires.length > 0) container.add(new RemoveWiresAction(...wires));

    for (const c of components) project.removeComponent(c.id);
    for (const w of wires) project.removeWire(w.id);

    project.actionManager.register(container);
  }
}
