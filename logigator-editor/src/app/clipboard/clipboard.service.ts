import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslationService } from '../translation/translation.service';
import { SerializedComponent } from '../components/serialized-component.model';
import { SerializedWire } from '../wires/serialized-wire.model';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ActionContainer } from '../actions/action-container';
import { RemoveComponentsAction } from '../actions/actions/remove-components.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { ComponentProviderService } from '../components/component-provider.service';
import { ComponentCategory } from '@logigator/core';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';

interface ClipboardData {
  components: SerializedComponent[];
  wires: SerializedWire[];
}

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly logging = inject(LoggingService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  private readonly _clipboard = signal<ClipboardData | null>(null);

  /** True once something has been copied — drives paste-button availability. */
  public readonly hasClipboard = computed(() => this._clipboard() !== null);

  /**
   * Drops the copied elements. The compact selection action bar stays on
   * screen for as long as there is something to paste, so it offers this as
   * its dismiss action.
   */
  public clear(): void {
    this._clipboard.set(null);
  }

  public copy(project: Project): void {
    const sm = project.selectionManager;
    if (sm.isEmpty) {
      return;
    }
    const data: ClipboardData = {
      components: [...sm.selectedComponents].map((c) => Component.serialize(c)),
      wires: [...sm.selectedWires].map((w) => Wire.serialize(w))
    };
    this._clipboard.set(data);
    this.logging.debug(
      `copy serialized ${data.components.length} component(s), ${data.wires.length} wire(s)`,
      'ClipboardService'
    );
  }

  public cut(project: Project): void {
    if (project.selectionManager.isEmpty || project.actionManager.locked) {
      return;
    }
    this.copy(project);
    this._applyDelete(project);
  }

  public delete(project: Project): void {
    if (project.selectionManager.isEmpty || project.actionManager.locked) {
      return;
    }
    this._applyDelete(project);
  }

  /**
   * Deserializes the clipboard into fresh instances and hands them to a
   * placement session. The instances keep the copied geometry — where the
   * group lands is the interaction layer's call (cursor, else the middle of
   * the viewport), so only its relative shape matters here.
   */
  public paste(project: Project): void {
    const data = this._clipboard();
    if (!data) {
      return;
    }
    const { components, wires } = data;
    const provider = getStaticDI(ComponentProviderService);

    // Plugs define a custom component's ports — outside a custom-component
    // document they are meaningless, so pasting there drops them.
    const allowPlugs = this.metadataStore.getMetadata(project)?.type === 'comp';

    let skippedPlugs = 0;
    const freshComponents: Component[] = [];
    for (const s of components) {
      const config = provider.getComponent(s.type);
      if (!config) continue;
      if (!allowPlugs && config.category === ComponentCategory.PORT) {
        skippedPlugs++;
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, type: _type, ...rest } = s;
      freshComponents.push(Component.deserialize(rest, config));
    }

    const freshWires: Wire[] = wires.map((w) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...rest } = w;
      return Wire.deserialize(rest);
    });

    this.logging.debug(
      `paste created ${freshComponents.length} component(s), ${freshWires.length} wire(s)`,
      'ClipboardService'
    );

    if (skippedPlugs > 0) {
      this.toast.warn(
        this.translation.translate('clipboard.pastePlugsSkipped'),
        'ClipboardService'
      );
    }

    // A clipboard component whose type is no longer registered is skipped
    const skipped = components.length - freshComponents.length - skippedPlugs;
    if (skipped > 0) {
      this.toast.warn(
        this.translation.translate('clipboard.pastePartial'),
        'ClipboardService'
      );
    }

    // Everything was filtered out — an empty paste session would only offer
    // a cancel gesture, so don't open one.
    if (freshComponents.length === 0 && freshWires.length === 0) {
      return;
    }

    project.startPasteSession(freshComponents, freshWires);
  }

  // Callers gate on actionManager.locked first: while a drag session holds
  // the selection detached, the removals below would silently no-op (the
  // elements are unindexed) while the recorded action claims they happened —
  // undo would then materialize duplicates.
  private _applyDelete(project: Project): void {
    const sm = project.selectionManager;

    // Snapshot before any mutation — evict() modifies these Sets
    const components = [...sm.selectedComponents];
    const wires = [...sm.selectedWires];

    // Deleting a scissor selection commits its cut: consume it before the
    // removals and coalesce below, so cut+delete stays one undo step.
    const cut = sm.consumeLiveCut();

    // Restore the wire invariants around the removal: a collinear pair whose
    // shared endpoint loses its last third terminator (a deleted wire's end or
    // a deleted component's port) merges back into one wire. toRemove covers
    // the selected wires plus any neighbours those merges absorb.
    const { toAdd, toRemove } = project.topology.integrate({
      removedWires: wires,
      removedComponentPorts: components.flatMap((c) => [...c.connectionPoints])
    });

    const container = new ActionContainer();

    // Serialize before removal — constructors capture positions eagerly
    if (components.length > 0)
      container.add(new RemoveComponentsAction(...components));
    if (toRemove.length > 0) container.add(new RemoveWiresAction(...toRemove));
    if (toAdd.length > 0) container.add(new AddWiresAction(...toAdd));

    for (const c of components) project.removeComponent(c.id);
    for (const w of toRemove) project.removeWire(w.id);
    for (const w of toAdd) project.addWire(w);

    if (toAdd.length > 0 || toRemove.length > wires.length) {
      this.logging.debug(
        `delete integration merged ${toAdd.length} wire(s) from ${toRemove.length - wires.length} absorbed neighbour(s)`,
        'ClipboardService'
      );
    }

    if (cut) {
      project.actionManager.coalesceTop(cut, container);
    } else {
      project.actionManager.register(container);
    }
  }
}
