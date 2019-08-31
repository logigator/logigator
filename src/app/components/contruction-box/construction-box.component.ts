import {Component, OnInit} from '@angular/core';
import {ComponentProviderService} from '../../services/component-provider/component-provider.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {WorkMode} from '../../models/work-modes';
import {FormControl} from '@angular/forms';
import {Observable} from 'rxjs';
import {debounceTime} from 'rxjs/operators';

@Component({
	selector: 'app-construction-box',
	templateUrl: './construction-box.component.html',
	styleUrls: ['./construction-box.component.scss']
})
export class ConstructionBoxComponent implements OnInit {

	public searchFormControl: FormControl;

	public searchText$: Observable<string>;

	constructor(private componentProviderService: ComponentProviderService, private workModeService: WorkModeService) { }

	ngOnInit(): void {
		this.searchFormControl = new FormControl('');
		this.searchText$ = this.searchFormControl.valueChanges.pipe(
			debounceTime(400)
		);
	}

	public get allAvailableComponents(): {id: number, name: string}[] {
		return this.componentProviderService.getAllComponents();
	}

	public availableComponentsTrackBy(index, item) {
		if (!item) return null;
		return item.id;
	}

	public selectComponent(id: number) {
		this.workModeService.setWorkMode('buildComponent', id);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public get currentSelectedComponent(): number {
		return this.workModeService.currentComponentToBuild;
	}
}
