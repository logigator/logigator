import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CreateShare} from '../../models/http-requests/create-share';
import {environment} from '../../../environments/environment';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {SetSharing} from '../../models/http-responses/set-sharing';

@Injectable({
	providedIn: 'root'
})
export class SharingService {

	constructor(private http: HttpClient) { }

	public async saveSettings(share: boolean, settings: CreateShare): Promise<string> {
		if (!share) return;
		// TODO: revoke share
		const resp = await this.http.post<HttpResponseData<SetSharing>>(environment.apiPrefix + '/api/share/create', settings).toPromise();
		if (resp.warnings && resp.warnings.length > 0) throw resp.warnings;
		return environment.domain + '/share/' + resp.result.address;
	}
}
