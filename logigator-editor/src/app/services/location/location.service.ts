import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class LocationService {

	public get isProject(): boolean {
		// #!web
		return this.pathname.startsWith('/project/');

		// #!electron
		return false;
	}

	public get isComponent(): boolean {
		// #!web
		return this.pathname.startsWith('/component/');

		// #!electron
		return false;
	}

	public get isShare(): boolean {
		// #!web
		return this.pathname.startsWith('/share/');

		// #!electron
		return false;
	}

	public get projectUuid(): string {
		// #!web
		return this.pathname.substring(9);

		// #!electron
		return '';
	}

	public get componentUuid(): string {
		// #!web
		return this.pathname.substring(11);

		// #!electron
		return '';
	}

	public get shareUuid(): string {
		// #!web
		return this.pathname.substring(7);

		// #!electron
		return '';
	}

	public set(type: 'project' | 'component' | 'share', uuid: string) {
		// #!web
		window.history.pushState(null, null, `/editor/${type}/${uuid}`);
	}

	public reset() {
		// #!web
		window.history.pushState(null, null, `/editor/`);
	}

	private get pathname(): string {
		return location.pathname.substring(7);
	}
}
