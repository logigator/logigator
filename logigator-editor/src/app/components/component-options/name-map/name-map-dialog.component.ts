import {
  Component,
  inputBinding,
  OnInit,
  outputBinding,
  signal,
  twoWayBinding,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { NameMap } from '@logigator/core';
import { LgButton, LgDialogContent } from '@logigator/ui';
import { TranslateDirective } from '../../../translation/translate.directive';
import type { NameMapEditor } from './name-map-editor';

export interface NameMapDialogData {
  editor: Type<NameMapEditor>;
  keys: readonly string[];
  names: NameMap;
  maxLength: number;
}

/**
 * Frames an owner-supplied {@link NameMapEditor} with Save and Cancel. The
 * editor edits a draft; Save closes with it and Cancel closes with nothing,
 * so the option sees at most one write per opening.
 */
@Component({
  selector: 'app-name-map-dialog',
  imports: [LgButton, TranslateDirective],
  templateUrl: './name-map-dialog.component.html'
})
export class NameMapDialogComponent
  extends LgDialogContent<NameMapDialogData, NameMap>
  implements OnInit
{
  @ViewChild('editorHost', { read: ViewContainerRef, static: true })
  private editorHost!: ViewContainerRef;

  private readonly draft = signal<NameMap>(this.dialogData?.names ?? {});

  public ngOnInit(): void {
    const data = this.dialogData;
    if (!data) return;
    this.editorHost.createComponent(data.editor, {
      bindings: [
        inputBinding('keys', () => data.keys),
        inputBinding('maxLength', () => data.maxLength),
        twoWayBinding('names', this.draft),
        outputBinding('save', () => this.save())
      ]
    });
  }

  protected save(): void {
    this.dialogRef.close(this.draft());
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
