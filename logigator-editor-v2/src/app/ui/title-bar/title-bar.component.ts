import { ChangeDetectionStrategy, Component, Signal } from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { LoggingService } from '../../logging/logging.service';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { HashedPipe } from '../../hashing/hashed.pipe';

@Component({
	selector: 'app-title-bar',
	standalone: true,
	imports: [MenubarModule, NgOptimizedImage, AsyncPipe, HashedPipe],
	templateUrl: './title-bar.component.html',
	styleUrl: './title-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TitleBarComponent {
	public items: Signal<MenuItem[]>;

	public constructor(
		private readonly loggingService: LoggingService,
		private readonly translocoService: TranslocoService
	) {
		this.items = toSignal(
			translocoService.events$.pipe(map(() => this.generateMenuItems())),
			{ initialValue: [] }
		);
	}

	private generateMenuItems(): MenuItem[] {
		return [
			{
				label: this.translocoService.translate('titleBar.menuBar.file.label'),
				items: [
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.file.items.newProject.label'
						),
						command: () => this.newProject()
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.file.items.newComponent.label'
						)
					},
					{
						separator: true
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.file.items.open.label'
						)
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.file.items.save.label'
						)
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.file.items.exportFile.label'
						)
					},
					{
						separator: true
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.file.items.generateImage.label'
						)
					}
				]
			},
			{
				label: this.translocoService.translate('titleBar.menuBar.edit.label'),
				items: [
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.edit.items.undo.label'
						)
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.edit.items.redo.label'
						)
					},
					{
						separator: true
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.edit.items.cut.label'
						)
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.edit.items.copy.label'
						)
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.edit.items.paste.label'
						)
					},
					{
						separator: true
					},
					{
						label: this.translocoService.translate(
							'titleBar.menuBar.edit.items.delete.label'
						)
					}
				]
			},
			{
				label: 'View'
			},
			{
				label: 'Help'
			}
		];
	}

	public newProject(): void {
		this.loggingService.log('New project', 'TitleBarComponent');
	}
}
