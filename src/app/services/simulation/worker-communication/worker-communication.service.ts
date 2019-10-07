import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class WorkerCommunicationService {

	constructor() {
		const worker = new Worker('../../../simulation-worker/simulation.worker', { type: 'module' });
		worker.postMessage({kek: 'worker'});
		worker.addEventListener('message', console.log);
	}
}
