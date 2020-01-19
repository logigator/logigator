import {
	ChangeDetectionStrategy,
	Component, ElementRef,
	Input,
	OnChanges,
	Renderer2,
	SimpleChanges, ViewChild,
	ViewEncapsulation
} from '@angular/core';

@Component({
	selector: 'app-help-renderer',
	templateUrl: './help-renderer.component.html',
	styleUrls: ['./help-renderer.component.scss'],
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpRendererComponent implements OnChanges {

	@Input()
	currentLang: string;

	@Input()
	helpToRender: string;

	@ViewChild('insertionPoint', {static: true})
	private insertionPoint: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2) { }

	ngOnChanges(changes: SimpleChanges): void {
		const fileToLoad = this.currentLang + '/' + this.helpToRender;
		this.renderer2.setProperty(this.insertionPoint.nativeElement, 'innerHTML', require(`../../../../help/${fileToLoad}.md`))
	}

}
