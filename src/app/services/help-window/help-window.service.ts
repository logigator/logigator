import {ComponentFactoryResolver, Injectable, ViewContainerRef} from '@angular/core';
import {HelpWindowComponent} from '../../components/help-window/help-window.component';
import {StorageService} from '../storage/storage.service';

@Injectable({
	providedIn: 'root'
})
export class HelpWindowService {

	private _helpWindowInsertionPoint: ViewContainerRef;

	private readonly _dontShowAgain: Set<string>;

	constructor(private componentFactoryResolver: ComponentFactoryResolver, private storage: StorageService) {
		const item = this.storage.get('helpWindows');
		this._dontShowAgain = item ? new Set(item) : new Set<string>();
	}


	public setHelpWindowInsertionPoint(value: ViewContainerRef) {
		this._helpWindowInsertionPoint = value;
	}

	public showHelpWindow(helpKey: string) {
		if (!this._dontShowAgain || this._dontShowAgain.has(helpKey))
			return;

		const compFactory = this.componentFactoryResolver.resolveComponentFactory(HelpWindowComponent);
		const componentInstance = this._helpWindowInsertionPoint.createComponent(compFactory);
		componentInstance.instance.helpToDisplay = helpKey;
		const closeSubscription = componentInstance.instance.requestClose.subscribe(dontShowAgain => {
			if (dontShowAgain) {
				this._dontShowAgain.add(helpKey);
				this.storage.set('helpWindows', [...this._dontShowAgain]);
			}
			componentInstance.destroy();
			closeSubscription.unsubscribe();
		});
	}
}
