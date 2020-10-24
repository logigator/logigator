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

@Injectable({
	providedIn: 'root'
})
export class ProjectSaveManagementService {

	constructor() {}

	public getProjectUuid(uuid: string): Promise<Project> {
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

}
