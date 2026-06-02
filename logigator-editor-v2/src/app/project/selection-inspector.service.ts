import {
	computed,
	effect,
	inject,
	Injectable,
	NgZone,
	signal
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Component } from '../components/component';
import { ComponentOption } from '../components/component-option';
import { ChangeOptionAction } from '../actions/actions/change-option.action';
import { Project } from './project';
import { ProjectService } from './project.service';

/**
 * Bridges canvas selection into the Angular settings panel (R11). It tracks the
 * **active project's** selection and exposes the single selected placed component
 * — the one whose options the inspector should edit — plus a proxied view of
 * those options whose writes are routed through {@link ChangeOptionAction} so
 * every edit is undoable and dirties the project.
 *
 * Selection fires from PixiJS pointer handlers, which run **outside** Angular's
 * zone (the board renders `runOutsideAngular`); the signal write is marshalled
 * back via {@link NgZone.run} so OnPush views update.
 */
@Injectable({ providedIn: 'root' })
export class SelectionInspectorService {
	private readonly projectService = inject(ProjectService);
	private readonly ngZone = inject(NgZone);

	private readonly _selectedComponent = signal<Component | null>(null);

	/** The single selected placed component, or null when zero/many are selected. */
	public readonly selectedComponent = computed(this._selectedComponent);

	/**
	 * A proxied view of the selected component's options for the settings form.
	 * Each proxy delegates reads to the real option but turns a `value =` write
	 * into a dispatched {@link ChangeOptionAction} against the active project,
	 * leaving the real option to be mutated by the action's `do()`.
	 */
	public readonly inspectorOptions = computed(() => {
		const component = this._selectedComponent();
		if (!component) return null;
		return this._proxyOptions(component);
	});

	private _watched: Project | null = null;
	private _sub?: Subscription;

	constructor() {
		effect(() => {
			this._watch(this.projectService.activeProject());
		});
	}

	private _watch(project: Project | null): void {
		if (project === this._watched) return;
		this._sub?.unsubscribe();
		this._watched = project;
		if (!project) {
			this._selectedComponent.set(null);
			return;
		}
		this._sub = project.selectionManager.selectionChange$.subscribe(() => {
			this._recompute(project);
		});
		this._recompute(project);
	}

	private _recompute(project: Project): void {
		const sm = project.selectionManager;
		const single =
			sm.selectedComponents.size === 1 && sm.selectedWires.size === 0
				? [...sm.selectedComponents][0]
				: null;
		// Selection handlers usually run outside Angular's zone (PixiJS pointer
		// events) — re-enter so the signal write schedules change detection. Guard
		// against re-entering when already inside the zone (e.g. selection driven
		// by Angular code), which would otherwise trigger a recursive tick.
		if (NgZone.isInAngularZone()) {
			this._selectedComponent.set(single);
		} else {
			this.ngZone.run(() => this._selectedComponent.set(single));
		}
	}

	private _proxyOptions(component: Component): Record<string, ComponentOption> {
		return Object.fromEntries(
			Object.entries(component.options).map(([key, option]) => [
				key,
				this._proxy(component.id, key, option)
			])
		);
	}

	private _proxy(
		componentId: number,
		key: string,
		option: ComponentOption
	): ComponentOption {
		const dispatch = (oldValue: unknown, newValue: unknown): void => {
			const project = this.projectService.activeProject();
			if (!project) return;
			project.actionManager.push(
				new ChangeOptionAction(componentId, key, oldValue, newValue)
			);
		};
		return new Proxy(option, {
			set(target, prop, value): boolean {
				if (prop === 'value') {
					const oldValue = target.value;
					// Don't mutate the real option here — the action's do() does, so
					// the change is captured in undo history rather than applied twice.
					if (oldValue !== value) dispatch(oldValue, value);
					return true;
				}
				return Reflect.set(target, prop, value);
			}
		});
	}
}
