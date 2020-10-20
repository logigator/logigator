import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CreateShare, UpdateShare} from '../../models/http-requests/share-settings';
import {environment} from '../../../environments/environment';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {CreateShareResp} from '../../models/http-responses/create-share-resp';
import {ShareInfo} from '../../models/http-responses/ShareInfo';
import {map} from 'rxjs/operators';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {Observable} from 'rxjs';
import {OpenShareResp} from '../../models/http-responses/open-share-resp';

@Injectable({
	providedIn: 'root'
})
export class SharingService {

	constructor(private http: HttpClient, private errorHandler: ErrorHandlingService) { }

	public async createShare(settings: CreateShare): Promise<HttpResponseData<CreateShareResp>> {
		return this.http.post<HttpResponseData<CreateShareResp>>(environment.api + '/share/create', settings).pipe(
			this.errorHandler.catchErrorOperator('ERROR.SHARE.CREATE', undefined)
		).toPromise();
	}

	public updateShare(settings: UpdateShare, address: string): Promise<HttpResponseData<any>> {
		return this.http.post<HttpResponseData<any>>(`${environment.api}/share/update/${address}`, settings).pipe(
			this.errorHandler.catchErrorOperator('ERROR.SHARE.UPDATE', undefined)
		).toPromise();
	}

	public deleteShare(address: string): Promise<HttpResponseData<any>> {
		return this.http.get<HttpResponseData<any>>(`${environment.api}/share/delete/${address}`).pipe(
			this.errorHandler.catchErrorOperator('ERROR.SHARE.DELETE', undefined)
		).toPromise();
	}

	public getShareSettings(projectId: number): Promise<ShareInfo> {
		return this.http.get<HttpResponseData<ShareInfo[]>>(environment.api + '/share/get').pipe(
			map(resp => {
				const share =  resp.result.find(s => s.project_id === projectId);
				if (share) {
					share.is_public = share.is_public !== 0;
					share.users = share.users.filter(u => u.email);
				}
				return share;
			}),
			this.errorHandler.catchErrorOperator('ERROR.SHARE.GET_INFO', undefined)
		).toPromise();
	}

	public openShare(address: string): Observable<OpenShareResp> {
		return this.http.get<HttpResponseData<OpenShareResp>>(environment.api + '/share/get/' + address).pipe(
			map(r => r.result)
		);
	}
}
