import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {EditorReleaseData} from '../../models/http-responses/editor-release-data';
import {map, shareReplay} from 'rxjs/operators';
// #!electron
import * as fs from 'fs';
// #!electron
import * as path from 'path';

@Injectable({
	providedIn: 'root'
})
export class ElectronUpdateService {

	private _latestReleaseInfo: Observable<EditorReleaseData>;

	private packageJson: any;

	constructor(private httpClient: HttpClient) {
		// #!electron
		this.readPackageJson();
	}

	private readPackageJson() {
		// #!if DEBUG === 'true'
		this.packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')).toString());
		// #!else
		this.packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'resources', 'app.asar', 'package.json')).toString())
		// #!endif
	}

	public get isNewVersionAvailable$(): Observable<boolean> {
		if (!this._latestReleaseInfo)
			this._latestReleaseInfo = this.httpClient.get<EditorReleaseData>('https://api.github.com/repos/logigator/logigator-editor/releases/latest').pipe(
				shareReplay(1)
			);

		return this._latestReleaseInfo.pipe(
			map(releaseInfo => {
				return (this.packageJson.version as string).localeCompare(releaseInfo.tag_name) < 0;
			})
		);
	}
}
