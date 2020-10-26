import {Injectable, NgZone, Optional} from '@angular/core';
import {Project} from '../../models/project';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {OpenProjectResponse} from '../../models/http-responses/open-project-response';
import {map, tap} from 'rxjs/operators';
import * as PIXI from 'pixi.js';
import {HttpClient} from '@angular/common/http';
import {Element} from '../../models/element';
import {ComponentInfoResponse} from '../../models/http-responses/component-info-response';
import {ProjectState} from '../../models/project-state';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {UserService} from '../user/user.service';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {ComponentLocalFile, ProjectLocalFile} from '../../models/project-local-file';
import {ModelDatabaseMap, ProjectModelResponse} from '../../models/http-responses/project-model-response';
import {CreateProjectResponse} from '../../models/http-responses/create-project-response';
import {SaveProjectRequest} from '../../models/http-requests/save-project-request';
import {ElementType} from '../../models/element-types/element-type';
import {Observable} from 'rxjs';
import {ProjectInfoResponse} from '../../models/http-responses/project-info-response';
import {environment} from '../../../environments/environment';
import {ElectronService} from 'ngx-electron';
import {saveLocalFile} from '../../models/save-local-file';
import {SharingService} from '../sharing/sharing.service';
import {Elements} from '../../models/elements';
import {OpenShareResp} from '../../models/http-responses/open-share-resp';
import {ElementTypeId} from '../../models/element-types/element-type-ids';
import {ApiService} from '../api/api.service';
import {LocationService} from '../location/location.service';
import {ProjectData, ProjectDependency, ProjectElement} from '../../models/http/response/project-data';
import {BiDirectionalMap} from '../../models/bi-directional-map';
import {ComponentInfo} from '../../models/http/response/component-info';
import {emit} from 'cluster';
import has = Reflect.has;

@Injectable({
	providedIn: 'root'
})
export class ProjectSaveManagementService {

	/**
	 * key: uuid
	 * value: editor number id
	 */
	private _mappings = new BiDirectionalMap<string, number>();

	constructor(
		private api: ApiService,
		private elementProvider: ElementProviderService,
		private location: LocationService
	) {}

	public async getInitialProjects(): Promise<Project[]> {
		let projects: Project[];
		if (this.location.isProject) {
			const mainProject = await this.getProjectUuid(this.location.projectUuid);
			projects = [mainProject];
		} else if (this.location.isComponent) {
			const comp = await this.getComponentUuid(this.location.componentUuid);
			const mainProject = Project.empty();
			projects = [mainProject, comp];
		} else if (this.location.isShare) {
			projects = [];
		} else {
			const mainProject = Project.empty();
			projects = [mainProject];
		}
		return projects;
	}

	public async getProjectUuid(uuid: string): Promise<Project> {
		const projectData = await this.api.get<ProjectData>(`/project/${uuid}`).toPromise();
		const mappingsToApply = this.saveMappings(projectData.data.dependencies);
		this.setCustomElements(projectData.data.dependencies.map(dep => dep.dependency), 'user');
		const elements = this.convertSavedElementsToElements(projectData.data.elements, mappingsToApply);
		return Promise.resolve(Project.empty('Test'));
	}

	public getComponentUuid(uuid: string): Promise<Project> {
		const p = new Project(new ProjectState(), {
			type: 'comp',
			name: 'comp',
			id: 0
		});
		return Promise.resolve(p);
	}

	public getComponent(id: number): Promise<Project> {
		const p = new Project(new ProjectState(), {
			type: 'comp',
			name: 'comp',
			id
		});
		return Promise.resolve(p);
	}

	public createProject(name: string, description = ''): Promise<Project> {
		const p = Project.empty(name);
		return Promise.resolve(p);
	}

	public createComponent(name: string, symbol: string, description: string = ''): Promise<Project> {
		const p = new Project(new ProjectState(), {
			type: 'comp',
			name,
			id: 0
		});
		return Promise.resolve(p);
	}

	public saveComponent(project: Project): Promise<void> {
		return Promise.resolve();
	}

	public saveProject(project: Project): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * returns mappings to apply to loaded elements
	 */
	private saveMappings(dependencies: ProjectDependency[]): Map<number, number> {
		const mappingsToApply = new Map<number, number>();
		dependencies.forEach(dep => {
			if (this._mappings.hasKey(dep.dependency.id)) {
				mappingsToApply.set(dep.model, this._mappings.getValue(dep.dependency.id));
			} else {
				this._mappings.set(dep.dependency.id, dep.model);
			}
		});
		return mappingsToApply;
	}

	private setCustomElements(components: ComponentInfo[], category: 'user' | 'local' | 'share') {
		const elements: Partial<ElementType>[] = components.map(comp => {
			return {
				id: this._mappings.getValue(comp.id),
				description: comp.description,
				name: comp.name,
				minInputs: comp.numInputs,
				maxInputs: comp.numInputs,
				symbol: comp.symbol,
				numInputs: comp.numInputs,
				numOutputs: comp.numOutputs,
				labels: comp.labels
			};
		});
		this.elementProvider.addElements(elements, category);
	}

	private convertSavedElementsToElements(elements: ProjectElement[], mappings: Map<number, number>): Element[] {
		const mapped: Element[] = [];

		for (const elem of elements) {
			const typeId = mappings.has(elem.t) ? mappings.get(elem.t) : elem.t;
			const elementType = this.elementProvider.getElementById(typeId);

			if (!elementType)
				return;

			const isCustomElement = this.elementProvider.isCustomElement(typeId);

			const element: Element = {
				id: elem.c,
				typeId,
				numInputs: isCustomElement ? elementType.numInputs : elem.i,
				numOutputs: isCustomElement ? elementType.numOutputs : elem.o,
				rotation: elem.r,
				data: elem.s,
				pos: new PIXI.Point(elem.p[0], elem.p[1])
			};
			if (elementType.hasPlugIndex && elem.n)
				element.plugIndex = elem.n[0];
			if (!elementType.hasPlugIndex)
				element.options = elem.n;
			if (elem.q)
				element.endPos = new PIXI.Point(elem.q[0], elem.q[1]);

			mapped.push(element);
		}

		return mapped;
	}

}
