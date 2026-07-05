import { signal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ComponentInspection } from '../component-inspection';
import { WatchSession } from '../../inspection/watch/watch-session';
import { SubCircuitWatchComponent } from '../../inspection/watch/sub-circuit-watch.component';
import { SimulationService } from '../../simulation/simulation.service';
import { getStaticDI } from '../../utils/get-di';
import { CustomComponent } from './custom-component';

/**
 * Live view of a placed custom component's inner circuit during simulation —
 * the inspection every custom config declares. Opens a fresh headless copy of
 * the instance's frozen snapshot circuit whose wires/ports light from the
 * running engine (via a {@link WatchSession} resolved through the compiled
 * board's watch index). The renderer owns the canvas and viewport; this model
 * owns the session and turns applied snapshots into render requests.
 */
export class SubCircuitWatch extends ComponentInspection {
  public readonly renderer = SubCircuitWatchComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 640, height: 480 },
    min: { width: 320, height: 240 }
  };

  public readonly session: WatchSession;

  private readonly _render$ = new Subject<void>();
  /** Emits when engine state changed under the view — re-blit the canvas. */
  public readonly render$: Observable<void> = this._render$.asObservable();

  constructor(component: CustomComponent) {
    super();
    const simulation = getStaticDI(SimulationService);
    const board = simulation.board;
    const definition = component.definition;
    const info =
      board && definition.circuit
        ? board.watch.infoFor(String(component.id))
        : null;
    if (!board || !definition.circuit || !info) {
      throw new Error(
        `"${definition.name}" has no watchable circuit in this simulation`
      );
    }
    this.session = new WatchSession(
      definition.circuit,
      info,
      board.descriptor.links
    );
    this.title = signal(definition.name);
  }

  public override onFrame(): void {
    if (this.session.onFrame()) {
      this._render$.next();
    }
  }

  public override destroy(): void {
    this.session.destroy();
  }
}
