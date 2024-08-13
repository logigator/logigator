import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentDef } from '../../../components/component-def.model';
import { ButtonModule } from 'primeng/button';
import { LoggingService } from '../../../logging/logging.service';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
	selector: 'app-component-list',
	standalone: true,
	imports: [ButtonModule, TranslocoDirective],
	templateUrl: './component-list.component.html',
	styleUrl: './component-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentListComponent {
	public headline = input<string>('');
	public components = input<ComponentDef[]>([]);
	public searchText = input<string>('');

	constructor(private readonly loggingService: LoggingService) {}

	public selectComponent(component: ComponentDef): void {
		this.loggingService.log(component, 'ComponentListComponent');
	}
}
