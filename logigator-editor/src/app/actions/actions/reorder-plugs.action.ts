import { ActionContainer } from '../action-container';
import { ChangeOptionAction } from './change-option.action';

export interface PlugReorderEntry {
  componentId: number;
  oldIndex: number;
  newIndex: number;
}

/**
 * Rewrites plug `index` options to a clean `0..n-1` in list order, making
 * duplicate or gappy ordering structurally impossible. One
 * {@link ChangeOptionAction} per plug that actually changed, so it is undoable
 * and dirty-tracked like any option edit.
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
