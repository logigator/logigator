import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {ElementType} from '../../models/element-types/element-type';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {TranslateService} from '@ngx-translate/core';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ProjectsService} from '../../services/projects/projects.service';

@Component({
	selector: 'app-construction-box-category',
	templateUrl: './construction-box-category.component.html',
	styleUrls: ['./construction-box-category.component.scss']
})
export class ConstructionBoxCategoryComponent {

	@Input()
	public components: Map<number, ElementType>;

	@Input()
	public categoryName: string;

	@Input()
	public searchText: string;

	constructor(
		private workModeService: WorkModeService,
		private translate: TranslateService,
		private elemProv: ElementProviderService,
		private projects: ProjectsService
	) { }

	public componentsTrackBy(index, item) {
		if (!item) return null;
		return item.key;
	}

	public isInSearchResult(toSearch: string): Observable<boolean> {
		return this.translate.get(toSearch).pipe(
			map(translated => translated.toLowerCase().includes(this.searchText.trim().toLowerCase()))
		);
	}

	public isCurrentCustomElement(id: number): boolean {
		if (!this.projects.currProject) return false;
		return this.elemProv.isUserElement(id) && this.projects.currProject.id === id;
	}

	public selectComponent(id: number) {
		this.workModeService.setWorkMode('buildComponent', id);
	}

	public openComponent(id: number) {
		if (!this.elemProv.isUserElement(id)) return;
		this.projects.openComponent(id);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public get currentSelectedComponent(): number {
		return this.workModeService.currentComponentToBuild;
	}
}
