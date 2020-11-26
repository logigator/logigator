import {ComponentFactory, ComponentFactoryResolver, Injectable, ViewContainerRef} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {LoadingSymbolComponent} from '../../components/loading-symbol/loading-symbol.component';

@Injectable({
	providedIn: 'root'
})
export class LoadingService {

	private _tasks: LoadingTask[] = [];
	private _tasks$ = new ReplaySubject<string[]>(1);
	private readonly _factory: ComponentFactory<LoadingSymbolComponent>;

	constructor(private componentFactoryResolver: ComponentFactoryResolver) {
		this._factory = this.componentFactoryResolver.resolveComponentFactory(LoadingSymbolComponent);
	}

	public get tasks$() {
		return this._tasks$;
	}

	public add(text: string, container?: ViewContainerRef, showTextInContainer = false) {
		const task: LoadingTask = {
			text,
			container,
			showTextInContainer
		};

		const instance = container?.createComponent(this._factory);
		if (instance && showTextInContainer)
			instance.instance.text = text;

		this._tasks.push(task);
		this._tasks$.next(this._tasks.map(x => x.text));

		return () => {
			task.container?.clear();
			this._tasks.filter((x) => x !== task);
			this._tasks$.next(this._tasks.map(x => x.text));
		};
	}

	public removeAll() {
		for (const task of this._tasks) {
			task.container?.clear();
		}
		this._tasks = [];
		this._tasks$.next([]);
	}
}

interface LoadingTask {
	text: string;
	container?: ViewContainerRef;
	showTextInContainer: boolean;
}
