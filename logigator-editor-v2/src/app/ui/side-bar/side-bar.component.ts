import { Component } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ComponentProviderService } from '../../components/component-provider.service';
import { ComponentListComponent } from './component-list/component-list.component';

@Component({
	selector: 'app-side-bar',
	standalone: true,
	imports: [
		InputTextModule,
		FormsModule,
		IconFieldModule,
		InputIconModule,
		ComponentListComponent
	],
	templateUrl: './side-bar.component.html',
	styleUrl: './side-bar.component.scss'
})
export class SideBarComponent {
	public searchText: string = '';

	constructor(
		private readonly componentProviderService: ComponentProviderService
	) {}

	public get basicComponents() {
		return this.componentProviderService.basicComponents;
	}

	public get advancedComponents() {
		return this.componentProviderService.advancedComponents;
	}
}
