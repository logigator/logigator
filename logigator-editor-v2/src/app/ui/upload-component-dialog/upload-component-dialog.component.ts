import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ConfirmationService,
  DialogConfig,
  DialogRef,
  LgButton,
  LgMessage,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { UserService } from '../../user/user.service';

export interface UploadComponentDialogData {
  masterTypeId: number;
  name: string;
}

export interface UploadComponentDialogResult {
  isPublic: boolean;
  /** Whether to also upload the resolvable local dependencies as separate entries. */
  withDependencies: boolean;
}

/**
 * Collects the options for uploading a local custom component to the cloud:
 * visibility (public/private) and, when the component embeds resolvable local
 * dependencies, whether to upload those as separate cloud entries too. Collects
 * input only — it closes with an {@link UploadComponentDialogResult} (or
 * `undefined` when cancelled); {@link CustomComponentService} performs the upload.
 * Visibility defaults to private to avoid surprise-publishing a previously-local
 * component.
 */
@Component({
  selector: 'app-upload-component-dialog',
  imports: [
    FormsModule,
    LgToggleSwitch,
    LgTooltip,
    LgButton,
    TranslocoDirective,
    LgMessage
  ],
  templateUrl: './upload-component-dialog.component.html'
})
export class UploadComponentDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly transloco = inject(TranslocoService);
  protected readonly userService = inject(UserService);

  private readonly data = this.config.data as
    | UploadComponentDialogData
    | undefined;

  protected readonly name = this.data?.name ?? '';
  protected readonly isPublic = signal(true);
  protected readonly dependencies = signal<
    { name: string; masterTypeId: number | null }[]
  >([]);

  /** Local dependencies that can be uploaded as their own cloud entries. */
  protected readonly uploadableDependencies = computed(() =>
    this.dependencies().filter((d) => d.masterTypeId !== null)
  );

  constructor() {
    const masterTypeId = this.data?.masterTypeId;
    if (masterTypeId !== undefined) {
      void this.customComponentService
        .localDependencies(masterTypeId)
        .then((deps) => this.dependencies.set(deps));
    }
  }

  protected cancel(): void {
    this.ref.close();
  }

  protected upload(): void {
    this.ref.close({
      isPublic: this.isPublic(),
      withDependencies: false
    } satisfies UploadComponentDialogResult);
  }

  protected uploadWithDependencies(event: Event): void {
    this.confirmation.confirm({
      key: 'inline',
      target: event.currentTarget as HTMLElement,
      message: this.transloco.translate('uploadComponent.withDepsConfirm', {
        count: this.uploadableDependencies().length
      }),
      acceptLabel: this.transloco.translate('uploadComponent.withDepsAccept'),
      rejectLabel: this.transloco.translate('uploadComponent.withDepsReject'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.ref.close({
          isPublic: this.isPublic(),
          withDependencies: true
        } satisfies UploadComponentDialogResult)
    });
  }
}
