import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgToggleSwitch } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { EditorSettingsService } from './editor-settings.service';

/** Renders an on/off toggle for every setting in `EditorSettingsService`. */
@Component({
  selector: 'app-settings',
  imports: [FormsModule, LgToggleSwitch, TranslocoDirective],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {
  protected readonly editorSettings = inject(EditorSettingsService);
}
