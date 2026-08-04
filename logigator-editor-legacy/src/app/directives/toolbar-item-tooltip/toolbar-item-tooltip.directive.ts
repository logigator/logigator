// @ts-strict-ignore
import {
	ApplicationRef,
	ComponentFactoryResolver,
	ComponentRef,
	Directive,
	ElementRef,
	EmbeddedViewRef,
	HostListener,
	Injector,
	Input
} from '@angular/core';
import { ToolbarItemTooltipComponent } from '../../components/toolbar-item-tooltip/toolbar-item-tooltip.component';

@Directive({
	selector: 'button.toolbar-button.[appToolbarItemTooltip]'
})
export class ToolbarItemTooltipDirective {
	@Input()
	tooltipText: string;

	private _componentRef: ComponentRef<ToolbarItemTooltipComponent>;

	private _showTimeout: ReturnType<typeof setTimeout>;

	constructor(
		private elementRef: ElementRef,
		private componentFactoryResolver: ComponentFactoryResolver,
		private appRef: ApplicationRef,
		private injector: Injector
	) {}

	@HostListener('mouseenter')
	onMouseEnter() {
		this.show();
	}

	@HostListener('mouseleave')
	onMouseLeave() {
		this.hide();
	}

	private show() {
		this._showTimeout = setTimeout(() => {
			if (this._componentRef) return;
			this._componentRef = this.componentFactoryResolver
				.resolveComponentFactory(ToolbarItemTooltipComponent)
				.create(this.injector);
			this._componentRef.instance.tooltipText = this.tooltipText;
			this._componentRef.instance.hostElement = this.elementRef;
			this.appRef.attachView(this._componentRef.hostView);
			const domElem = (this._componentRef.hostView as EmbeddedViewRef<unknown>)
				.rootNodes[0] as HTMLElement;
			document.body.appendChild(domElem);
		}, 100);
	}

	private hide() {
		clearTimeout(this._showTimeout);
		if (!this._componentRef) return;
		this.appRef.detachView(this._componentRef.hostView);
		this._componentRef.destroy();
		delete this._componentRef;
	}
}
