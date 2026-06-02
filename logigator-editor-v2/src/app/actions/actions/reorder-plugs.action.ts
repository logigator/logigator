import { ActionContainer } from '../action-container';
import { ChangeOptionAction } from './change-option.action';

export interface PlugReorderEntry {
	componentId: number;
	oldIndex: number;
	newIndex: number;
}

/**
 * Rewrites plug `index` options to a clean `0..n-1` in list order (the Ports
 * panel's drag-to-reorder). A thin specialization of {@link ActionContainer}
 * over one {@link ChangeOptionAction} per plug whose index actually changed, so
 * it is undoable and dirty-tracked like any option edit — and clean indices make
 * duplicate/gappy ordering structurally impossible.
 */
export class ReorderPlugsAction extends ActionContainer {
	constructor(entries: PlugReorderEntry[]) {
		super(
			...entries
				.filter((entry) => entry.oldIndex !== entry.newIndex)
				.map(
					(entry) =>
						new ChangeOptionAction(
							entry.componentId,
							'index',
							entry.oldIndex,
							entry.newIndex
						)
				)
		);
	}
}
