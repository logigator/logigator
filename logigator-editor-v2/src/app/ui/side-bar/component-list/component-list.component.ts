import { Component, Input } from '@angular/core';
import { ComponentDef } from '../../../components/component-def.model';
import { NgForOf } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { LoggingService } from '../../../logging/logging.service';

@Component({
	selector: 'app-component-list',
	standalone: true,
	imports: [NgForOf, ButtonModule],
	templateUrl: './component-list.component.html',
	styleUrl: './component-list.component.scss'
})
export class ComponentListComponent {
	@Input() public headline: string = '';
	@Input() public components: ComponentDef[] = [];
	@Input() public searchText: string = '';

	constructor(private readonly loggingService: LoggingService) {}

	public selectComponent(component: ComponentDef): void {
		this.loggingService.log(component, 'ComponentListComponent');
	}
}
