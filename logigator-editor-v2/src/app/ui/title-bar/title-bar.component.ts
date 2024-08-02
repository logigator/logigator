import { Component } from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { LoggingService } from '../../logging/logging.service';
import { NgOptimizedImage } from '@angular/common';

@Component({
	selector: 'app-title-bar',
	standalone: true,
	imports: [MenubarModule, NgOptimizedImage],
	templateUrl: './title-bar.component.html',
	styleUrl: './title-bar.component.scss'
})
export class TitleBarComponent {
	public items: MenuItem[] = [
		{
			label: 'File',
			items: [
				{
					label: 'New Project',
					command: () => this.newProject()
				},
				{
					label: 'New Component'
				},
				{
					separator: true
				},
				{
					label: 'Open'
				},
				{
					label: 'Save'
				},
				{
					label: 'Export to file'
				},
				{
					separator: true
				},
				{
					label: 'Generate image'
				}
			]
		},
		{
			label: 'Edit',
			items: [
				{
					label: 'Undo'
				},
				{
					label: 'Redo'
				},
				{
					separator: true
				},
				{
					label: 'Cut'
				},
				{
					label: 'Copy'
				},
				{
					label: 'Paste'
				},
				{
					separator: true
				},
				{
					separator: true
				},
				{
					label: 'Delete'
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

	public constructor(private readonly loggingService: LoggingService) {}

	public newProject(): void {
		this.loggingService.log('New project', 'TitleBarComponent');
	}
}
