import {ChangeDetectorRef, Component, ElementRef, OnInit, Renderer2, ViewChild} from '@angular/core';
import {ReqInspectElementEvent} from '../../models/rendering/req-inspect-element-event';
import {WindowWorkAreaMeta} from '../../models/rendering/window-work-area-meta';
import {ProjectSaveManagementService} from '../../services/project-save-management/project-save-management.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';

@Component({
	selector: 'app-work-area-container',
	templateUrl: './work-area-container.component.html',
	styleUrls: ['./work-area-container.component.scss']
})
export class WorkAreaContainerComponent implements OnInit {

	public windowWorkAreas: WindowWorkAreaMeta[] = [];

	@ViewChild('windowDragBounding', {static: true})
	workAreaContainer: ElementRef<HTMLElement>;

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private cdr: ChangeDetectorRef,
		private workMode: WorkModeService,
		private renderer2: Renderer2
	) { }

	ngOnInit() {
		this.workMode.onSimulationModeChange.subscribe(isSim => {
			if (isSim) {
				this.renderer2.setStyle(this.workAreaContainer.nativeElement, 'width', '100%');
			} else {
				this.renderer2.removeStyle(this.workAreaContainer.nativeElement, 'width');
			}
		});
	}

	async onRequestElementInspection(event: ReqInspectElementEvent) {
		console.log(event);
		if (this.windowWorkAreas.find(w => w.identifier === event.identifier)) return;
		this.windowWorkAreas.push({
			identifier: event.identifier,
			project: await this.projectSaveManagement.openComponent(event.typeId)
		});
		this.cdr.detectChanges();
	}

}
