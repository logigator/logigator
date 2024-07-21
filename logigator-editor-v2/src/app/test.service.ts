import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class TestService {
	public test: string = 'test';

	constructor() {}
}
