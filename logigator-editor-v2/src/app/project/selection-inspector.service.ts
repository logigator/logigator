import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, scan, startWith, switchMap } from 'rxjs';
import { Component } from '../components/component';
import { ProjectService } from './project.service';

/**
 * Bridges canvas selection into the Angular settings panel (R11). It tracks the
 * **active project's** selection and exposes the single selected placed
 * component — the one whose options the inspector should edit.
 *
 * Selection fires from PixiJS pointer handlers, but no zone marshalling is
 * needed: the active project's `selectionChange$` is folded into a signal via
 * {@link toSignal}, so a write from any execution context notifies the change
 * detection scheduler. {@link switchMap} re-targets the stream when the active
 * project changes and tears the previous subscription down.
 */
@Injectable({ providedIn: 'root' })
export class SelectionInspectorService {
	private readonly projectService = inject(ProjectService);

	// Re-emits on every selection change of the active project; `startWith`
	// reflects the project's current selection the moment it becomes active.
	// `scan` turns the void emissions into a monotonic counter so each one is a
	// distinct value — otherwise toSignal's equality check would dedupe the
	// identical `undefined`s and the computed below would never re-run.
	private readonly selectionTick = toSignal(
		toObservable(this.projectService.activeProject).pipe(
			switchMap((project) =>
				project
					? project.selectionManager.selectionChange$.pipe(startWith(void 0))
					: of(void 0)
			),
			scan((n) => n + 1, 0)
		)
	);

	/** The single selected placed component, or null when zero/many are selected. */
	public readonly selectedComponent = computed<Component | null>(() => {
		this.selectionTick();
		const sm = this.projectService.activeProject()?.selectionManager;
		if (!sm) return null;
		return sm.selectedComponents.size === 1 && sm.selectedWires.size === 0
			? [...sm.selectedComponents][0]
			: null;
	});
}
