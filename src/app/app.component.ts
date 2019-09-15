import {Component, ElementRef, NgZone, OnInit, Renderer2, ViewChild} from '@angular/core';
import {ThemingService} from './services/theming/theming.service';
import {SelectionService} from './services/selection/selection.service';
import {WorkModeService} from './services/work-mode/work-mode.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

	@ViewChild('appRoot', {static: true})
	private appRoot: ElementRef<HTMLDivElement>;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private theming: ThemingService,
		private workMode: WorkModeService,
		private selection: SelectionService
	) {}

	ngOnInit(): void {
		this.ngZone.runOutsideAngular(() => {
			this.renderer2.listen('document', 'contextmenu', (e: MouseEvent) => {
				e.preventDefault();
			});
		});

		this.renderer2.addClass(this.appRoot.nativeElement, this.theming.themeClass);
	}

	public get showSettingsInfoBox(): boolean {
		return this.workMode.currentWorkMode === 'buildComponent' || this.selection.isSingleSelect();
	}

	public get selectionMode(): 'type' | 'placed' {
		if (this.workMode.currentWorkMode === 'buildComponent') {
			return 'type';
		}
		return 'placed';
	}

	public get selectedCompTypeId(): number {
		return this.workMode.currentComponentToBuild;
	}

	public get selectedCompId(): number {
		if (!this.selection.selectedIds()) {
			return null;
		}
		return this.selection.selectedIds()[0];
	}

}
