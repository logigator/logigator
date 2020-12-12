import {ComponentFactory, ComponentFactoryResolver, Injectable, ViewContainerRef} from '@angular/core';
import {Observable, ReplaySubject} from 'rxjs';
import {LoadingSymbolComponent} from '../../components/loading-symbol/loading-symbol.component';

@Injectable({
	providedIn: 'root'
})
export class LoadingService {

	private _tasks = new Set<LoadingTask>();
	private _tasks$ = new ReplaySubject<string[]>(1);
	private readonly _factory: ComponentFactory<LoadingSymbolComponent>;

	constructor(private componentFactoryResolver: ComponentFactoryResolver) {
		this._factory = this.componentFactoryResolver.resolveComponentFactory(LoadingSymbolComponent);
	}

	public get tasks$(): Observable<string[]> {
		return this._tasks$.asObservable();
	}

	public add(text: string, container?: ViewContainerRef, showTextInContainer = false): () => void {
		const task: LoadingTask = {
			text,
			container,
			showTextInContainer
		};

		const instance = container?.createComponent(this._factory);
		if (instance && showTextInContainer)
			instance.instance.text = text;

		this._tasks.add(task);
		this._tasks$.next([...this._tasks.values()].map(x => x.text));

		return () => {
			task.container?.clear();
			this._tasks.delete(task);
			this._tasks$.next([...this._tasks.values()].map(x => x.text));
		};
	}

	public removeAll() {
		for (const task of this._tasks) {
			task.container?.clear();
		}
		this._tasks.clear();
		this._tasks$.next([]);
	}
}

interface LoadingTask {
	text: string;
	container?: ViewContainerRef;
	showTextInContainer: boolean;
}
