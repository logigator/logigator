import {
	ApplicationRef,
	ComponentFactoryResolver,
	EmbeddedViewRef, Inject,
	Injectable,
	Injector,
	Type
} from '@angular/core';
import {PopupContentComp} from '../../components/popup/popup-content-comp';
import {PopupComponent} from '../../components/popup/popup.component';
import {DOCUMENT} from '@angular/common';

@Injectable({
	providedIn: 'root'
})
export class PopupService {

	private _popupOpened = false;

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		private appRef: ApplicationRef,
		private injector: Injector,
		@Inject(DOCUMENT) private document: Document
	) { }

	public showPopup<In, Out>(
		popupContentComp: Type<PopupContentComp<In, Out>>,
		title: string,
		closeOnClickOutside: boolean,
		contentComponentInput?: In,
		titleTranslationParams?: { [key: string]: string}
	): Promise<Out> {
		return new Promise<Out>(resolve => {
			const popupFactory = this.componentFactoryResolver.resolveComponentFactory(PopupComponent);
			const popupRef = popupFactory.create(this.injector);
			popupRef.instance.title = title;
			popupRef.instance.titleTranslationParams = titleTranslationParams;
			popupRef.instance.closeOnClickOutside = closeOnClickOutside;
			popupRef.instance.contentCompInput = contentComponentInput;
			popupRef.instance.contentComp = this.componentFactoryResolver.resolveComponentFactory(popupContentComp);
			this.appRef.attachView(popupRef.hostView);
			const domElem = (popupRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
			this.document.body.appendChild(domElem);
			this._popupOpened = true;

			const subscription = popupRef.instance.requestClose.subscribe(output => {
				this.appRef.detachView(popupRef.hostView);
				popupRef.destroy();
				subscription.unsubscribe();
				this._popupOpened = false;
				resolve(output);
			});
		});
	}

	public get isPopupOpened(): boolean {
		return this._popupOpened;
	}
}
