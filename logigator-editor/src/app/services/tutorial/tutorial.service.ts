import {ComponentFactoryResolver, Inject, Injectable, ViewContainerRef} from '@angular/core';
import {HelpWindowComponent} from '../../components/help-window/help-window.component';
import {StorageService, StorageServiceModel} from '../storage/storage.service';
import {Tutorial} from '../../models/tutorial';
import {basic} from '../../models/tutorials/basic';

@Injectable({
	providedIn: 'root'
})
export class TutorialService {

	private _helpWindowInsertionPoint: ViewContainerRef;

	private _tutorials = new Map<string, Tutorial>([
		['basic', basic]
	]);

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		@Inject(StorageService) private storage: StorageServiceModel,
	) {}


	public setHelpWindowInsertionPoint(value: ViewContainerRef) {
		this._helpWindowInsertionPoint = value;
	}

	public startTutorial(tutorialName: string) {

	}

	// public showHelpWindow(helpKey: string) {
	// 	if (this._currentlyShowing.has(helpKey) || !this._dontShowAgain || this._dontShowAgain.has(helpKey))
	// 		return;
	//
	// 	this._currentlyShowing.add(helpKey);
	// 	const compFactory = this.componentFactoryResolver.resolveComponentFactory(HelpWindowComponent);
	// 	const componentInstance = this._helpWindowInsertionPoint.createComponent(compFactory);
	// 	componentInstance.instance.helpToDisplay = helpKey;
	// 	const closeSubscription = componentInstance.instance.requestClose.subscribe(dontShowAgain => {
	// 		this._currentlyShowing.delete(helpKey);
	// 		if (dontShowAgain) {
	// 			this._dontShowAgain.add(helpKey);
	// 			this.storage.set('helpWindows', [...this._dontShowAgain]);
	// 		}
	// 		componentInstance.destroy();
	// 		closeSubscription.unsubscribe();
	// 	});
	// }
}
