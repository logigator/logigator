import { Component } from '@angular/core';
import { Button } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';

@Component({
	selector: 'app-tool-bar',
	standalone: true,
	imports: [Button, DividerModule, TooltipModule],
	templateUrl: './tool-bar.component.html',
	styleUrl: './tool-bar.component.scss'
})
export class ToolBarComponent {}
