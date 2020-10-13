import {ComponentFactoryResolver, Injectable, ViewContainerRef} from '@angular/core';
import {HelpWindowComponent} from '../../components/help-window/help-window.component';
import {StorageService} from '../storage/storage.service';
import {InitService} from '../init/init.service';

@Injectable({
	providedIn: 'root'
})
export class HelpWindowService {

	private _helpWindowInsertionPoint: ViewContainerRef;

	private _dontShowAgain: Set<string>;
	private readonly _currentlyShowing = new Set<string>();

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		private storage: StorageService,
		private init: InitService
	) {
		this._dontShowAgain = this.init.helpWindowServiceData;
	}


	public setHelpWindowInsertionPoint(value: ViewContainerRef) {
		this._helpWindowInsertionPoint = value;
	}

	public showHelpWindow(helpKey: string) {
		if (this._currentlyShowing.has(helpKey) || !this._dontShowAgain || this._dontShowAgain.has(helpKey))
			return;

		this._currentlyShowing.add(helpKey);
		const compFactory = this.componentFactoryResolver.resolveComponentFactory(HelpWindowComponent);
		const componentInstance = this._helpWindowInsertionPoint.createComponent(compFactory);
		componentInstance.instance.helpToDisplay = helpKey;
		const closeSubscription = componentInstance.instance.requestClose.subscribe(dontShowAgain => {
			this._currentlyShowing.delete(helpKey);
			if (dontShowAgain) {
				this._dontShowAgain.add(helpKey);
				this.storage.set('helpWindows', [...this._dontShowAgain]);
			}
			componentInstance.destroy();
			closeSubscription.unsubscribe();
		});
	}
}
