import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class LocationService {

	public get isProject(): boolean {
		return this.pathname.startsWith('/project/');
	}

	public get isComponent(): boolean {
		return this.pathname.startsWith('/component/');
	}

	public get isShare(): boolean {
		return this.pathname.startsWith('/share/');
	}

	public get projectUuid(): string {
		return this.pathname.substring(9);
	}

	public get componentUuid(): string {
		return this.pathname.substring(11);
	}

	public get shareUuid(): string {
		return this.pathname.substring(7);
	}

	public clear() {
		window.history.pushState(null, null, '/editor/');
	}

	public set(type: 'project' | 'component' | 'share', uuid: string) {
		window.history.pushState(null, null, `/editor/${type}/${uuid}`);
	}

	private get pathname(): string {
		return location.pathname.substring(7);
	}
}
