import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PopupContentComp } from '../../popup/popup-content-comp';

/**
 * Warns that the open project was saved by the new editor, whose format this
 * editor only partially supports. Used in two modes via {@link inputFromOpener}:
 * `open` is an acknowledgement on load; `save` is a blocking confirmation before
 * a save that would degrade the new-format data (e.g. drop negated ports).
 */
@Component({
	selector: 'app-new-editor-format',
	templateUrl: './new-editor-format.component.html',
	styleUrls: ['./new-editor-format.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewEditorFormatComponent extends PopupContentComp<
	'open' | 'save',
	boolean
> {
	get isSave(): boolean {
		return this.inputFromOpener === 'save';
	}

	okClick() {
		this.requestClose.emit(true);
	}

	cancelClick() {
		this.requestClose.emit(false);
	}
}
