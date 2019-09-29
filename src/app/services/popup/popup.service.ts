import {ApplicationRef, ComponentFactoryResolver, EmbeddedViewRef, Injectable, Injector} from '@angular/core';
import {PopupComponent} from '../../components/popup/popup/popup.component';

@Injectable({
	providedIn: 'root'
})
export class PopupService {

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		private appRef: ApplicationRef,
		private injector: Injector
	) { }

	public showPopup(popupContentComp: any, title: string, closeOnClickOutside = true): Promise<any> {
		return new Promise<void>(resolve => {
			const popupFactory = this.componentFactoryResolver.resolveComponentFactory(PopupComponent);
			const popupRef = popupFactory.create(this.injector);
			popupRef.instance.title = title;
			popupRef.instance.closeOnClickOutside = closeOnClickOutside;
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
