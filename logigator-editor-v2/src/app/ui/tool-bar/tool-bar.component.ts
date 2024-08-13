import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';

@Component({
	selector: 'app-tool-bar',
	standalone: true,
	imports: [ButtonModule, DividerModule, TooltipModule],
	templateUrl: './tool-bar.component.html',
	styleUrl: './tool-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolBarComponent {}
