import {ApplicationRef, ComponentFactoryResolver, EmbeddedViewRef, Injectable, Injector, Type} from '@angular/core';
import {PopupComponent} from '../../components/popup/popup/popup.component';
import {PopupContentComp} from '../../components/popup/popup-contents/popup-content-comp';

@Injectable({
	providedIn: 'root'
})
export class PopupService {

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		private appRef: ApplicationRef,
		private injector: Injector
	) { }

	public showPopup(
		popupContentComp: Type<PopupContentComp>,
		title: string,
		closeOnClickOutside: boolean,
		contentComponentInput?: any
	): Promise<any> {
	public showPopup(popupContentComp: Type<PopupContentComp>, title: string, closeOnClickOutside = true): Promise<void> {
		return new Promise<void>(resolve => {
			const popupFactory = this.componentFactoryResolver.resolveComponentFactory(PopupComponent);
			const popupRef = popupFactory.create(this.injector);
			popupRef.instance.title = title;
			popupRef.instance.closeOnClickOutside = closeOnClickOutside;
			popupRef.instance.contentCompInput = contentComponentInput;
			popupRef.instance.contentComp = this.componentFactoryResolver.resolveComponentFactory(popupContentComp);
			this.appRef.attachView(popupRef.hostView);
			const domElem = (popupRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
			document.body.appendChild(domElem);

			const subscription = popupRef.instance.requestClose.subscribe(output => {
				this.appRef.detachView(popupRef.hostView);
				popupRef.destroy();
				subscription.unsubscribe();
				resolve(output);
			});
		});
	}
}
