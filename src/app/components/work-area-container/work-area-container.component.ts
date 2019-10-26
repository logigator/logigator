import {ChangeDetectorRef, Component, ElementRef, OnInit, Renderer2, ViewChild} from '@angular/core';
import {ReqInspectElementEvent} from '../../models/rendering/req-inspect-element-event';
import {WindowWorkAreaMeta} from '../../models/rendering/window-work-area-meta';
import {ProjectSaveManagementService} from '../../services/project-save-management/project-save-management.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ErrorHandlingService} from '../../services/error-handling/error-handling.service';
import {ToastContainerDirective} from 'ngx-toastr';

@Component({
	selector: 'app-work-area-container',
	templateUrl: './work-area-container.component.html',
	styleUrls: ['./work-area-container.component.scss']
})
export class WorkAreaContainerComponent implements OnInit {

	public windowWorkAreas: WindowWorkAreaMeta[] = [{showing: false}, {showing: false}];

	@ViewChild('windowDragBounding', {static: true})
	workAreaContainer: ElementRef<HTMLElement>;

	@ViewChild(ToastContainerDirective, {static: true})
	toastContainer: ToastContainerDirective;

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private cdr: ChangeDetectorRef,
		private workMode: WorkModeService,
		private renderer2: Renderer2,
		private errorHandling: ErrorHandlingService
	) { }

	ngOnInit() {
		this.workMode.onSimulationModeChange.subscribe(isSim => {
			if (isSim) {
				this.renderer2.setStyle(this.workAreaContainer.nativeElement, 'width', '100%');
			} else {
				this.renderer2.removeStyle(this.workAreaContainer.nativeElement, 'width');
				this.windowWorkAreas.forEach(a => a.showing = false);
				this.cdr.detectChanges();
			}
		});

		this.errorHandling.setToastrContainer(this.toastContainer);
	}

	async onRequestElementInspection(event: ReqInspectElementEvent, fromWindow?: number) {
		if (this.windowWorkAreas.find(a => a.identifier === event.identifier)) return;

		const meta: WindowWorkAreaMeta = {
			showing: true,
			project: await this.projectSaveManagement.openComponent(event.typeId),
			identifier: event.identifier,
			parentNames: event.parentNames,
			parentTypesIds: event.parentTypeIds,
			zIndex: 1
		};

		this.moveAllBack();

		if (fromWindow === undefined) {
			meta.parentNames.shift();
			let firstHidden = this.windowWorkAreas.find(a => !a.showing);
			if (!firstHidden) firstHidden = this.windowWorkAreas[0];
			firstHidden.showing = meta.showing;
			firstHidden.identifier = meta.identifier;
			firstHidden.project = meta.project;
			firstHidden.parentNames = meta.parentNames;
			firstHidden.parentTypesIds = meta.parentTypesIds;
			firstHidden.zIndex = meta.zIndex;
			this.cdr.detectChanges();
			return;
		}

		this.windowWorkAreas[fromWindow].showing = meta.showing;
		this.windowWorkAreas[fromWindow].identifier = meta.identifier;
		this.windowWorkAreas[fromWindow].project = meta.project;
		this.windowWorkAreas[fromWindow].parentNames = meta.parentNames;
		this.windowWorkAreas[fromWindow].parentTypesIds = meta.parentTypesIds;
		this.windowWorkAreas[fromWindow].zIndex = meta.zIndex;
		this.cdr.detectChanges();
	}

	private moveAllBack() {
		for (let i = 0; i < this.windowWorkAreas.length; i++) {
			this.windowWorkAreas[i].zIndex = 0;
		}
	}

	public setOnTop(window: number) {
		this.moveAllBack();
		this.windowWorkAreas[window].zIndex = 1;
	}

	requestHide(window: number) {
		this.windowWorkAreas[window].showing = false;
		this.windowWorkAreas[window].identifier = null;
		this.cdr.detectChanges();
	}

}
