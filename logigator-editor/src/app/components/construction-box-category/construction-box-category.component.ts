// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ElementType } from '../../models/element-types/element-type';
import { WorkMode } from '../../models/work-modes';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
	selector: 'app-construction-box-category',
	templateUrl: './construction-box-category.component.html',
	styleUrls: ['./construction-box-category.component.scss']
})
export class ConstructionBoxCategoryComponent {
	@Input()
	public components: ElementType[];

	@Input()
	public categoryName: string;

	@Input()
	public showReloadButton: boolean;

	@Output()
	public reloadElements = new EventEmitter<void>();

	@Input()
	public searchText: string;

	constructor(
		private translate: TranslateService
	) {}

	public componentsTrackBy(index, item: ElementType) {
		if (!item) return null;
		return item.id;
	}

	public isHiddenPlug(toSearch: string, typeId: number): boolean {
		if (toSearch === '' || typeId !== 102) return false;
		return toSearch.trim().toLowerCase().replace(' ', '') === 'buttplug';
	}

	public isInSearchResult(toSearch: ElementType): Observable<boolean> {
		return this.translate
			.get(toSearch.name)
			.pipe(
				map(
					(translated) =>
						translated
							.toLowerCase()
							.includes(this.searchText.trim().toLowerCase()) ||
						toSearch.symbol
							.toLowerCase()
							.includes(this.searchText.trim().toLowerCase())
				)
			);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public isCurrentCustomElement(id: number): boolean {
		// if (!this.projects.currProject) return false;
		// return (
		// 	this.elemProv.isCustomElement(id) && this.projects.currProject.id === id
		// );
		return false;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public selectComponent(id: number) {
		// this.workModeService.setWorkMode(WorkMode.COMPONENT, id);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public openComponent(id: number) {
		//if (!this.elemProv.isCustomElement(id)) return;
		//this.projects.openComponent(id);
	}

	public get isComponentMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.COMPONENT;
		return false;
	}

	public get currentSelectedComponent(): number {
		// return this.workModeService.currentComponentToBuild;
		return 0;
	}

	public reloadButtonClick() {
		this.reloadElements.emit();
	}
}
