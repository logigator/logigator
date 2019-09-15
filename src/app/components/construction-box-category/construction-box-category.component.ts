import {Component, Input} from '@angular/core';
import {ElementType} from '../../models/element-type';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';

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

	constructor(private workModeService: WorkModeService) { }

	public componentsTrackBy(index, item) {
		if (!item) return null;
		return item.key;
	}

	public isInSearchResult(toSearch: string): boolean {
		return toSearch.toLowerCase().includes(this.searchText.trim().toLowerCase());
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
