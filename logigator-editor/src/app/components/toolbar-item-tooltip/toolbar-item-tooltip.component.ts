import {
	AfterViewInit,
	Component,
	ElementRef,
	Input,
	Renderer2,
	ViewChild
} from '@angular/core';

@Component({
	selector: 'app-toolbar-item-tooltip',
	templateUrl: './toolbar-item-tooltip.component.html',
	styleUrls: ['./toolbar-item-tooltip.component.scss']
})
export class ToolbarItemTooltipComponent implements AfterViewInit {
	@Input()
	public tooltipText: string;

	@Input()
	hostElement: ElementRef<HTMLElement>;

	@ViewChild('tooltip', { static: true })
	tooltipRef: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2) {}

	ngAfterViewInit() {
		const scrollY = window.pageYOffset;
		const hostElementHeight = this.hostElement.nativeElement.offsetHeight;
		const hostElementWidth = this.hostElement.nativeElement.offsetWidth;
		const hostElementPos =
			this.hostElement.nativeElement.getBoundingClientRect();

		this.renderer2.setStyle(
			this.tooltipRef.nativeElement,
			'top',
			hostElementPos.top + scrollY + hostElementHeight + 4 + 'px'
		);
		this.renderer2.setStyle(this.tooltipRef.nativeElement, 'z-index', '100');

		let left =
			hostElementPos.left +
			hostElementWidth / 2 -
			this.tooltipRef.nativeElement.offsetWidth / 2;
		if (left < 0) left = 0;
		this.renderer2.setStyle(this.tooltipRef.nativeElement, 'left', left + 'px');
	}
}
