import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Input, OnDestroy,
	Output,
	ViewChild
} from '@angular/core';
import {ThemingService} from '../../services/theming/theming.service';
import {ExplanationBoxLoc, TutorialStep} from '../../models/tutorial';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
	selector: 'app-tutorial-window',
	templateUrl: './tutorial-window.component.html',
	styleUrls: ['./tutorial-window.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TutorialWindowComponent implements OnDestroy {

	@Input()
	public step: Omit<TutorialStep, 'elementToExplain'> & {elementToExplain: HTMLElement};

	@Input()
	public isLastStep: boolean;

	@Output()
	skip: EventEmitter<void> = new EventEmitter<void>();

	@Output()
	next: EventEmitter<void> = new EventEmitter<void>();

	@ViewChild('tutorialWindow', {static: true})
	tutorialWindow: ElementRef<HTMLDivElement>;

	public arrowTop: number;
	public arrowLeft: number;

	private _destroySubject = new Subject();

	constructor(private theming: ThemingService, private cdr: ChangeDetectorRef) {
		fromEvent(window, 'resize').pipe(
			takeUntil(this._destroySubject)
		).subscribe(() => this.elementToExplainChanged());
	}

	public elementToExplainChanged() {
		this.tutorialWindow.nativeElement.classList.remove('top', 'left', 'bottom', 'right');
		delete this.arrowLeft;
		delete this.arrowTop;

		if (!this.step.elementToExplain) {
			this.xPos = window.innerWidth / 2 - this.tutorialWindow.nativeElement.offsetWidth / 2;
			this.yPos = window.innerHeight / 2 - this.tutorialWindow.nativeElement.offsetHeight / 2;
			this.cdr.detectChanges();
			return;
		}

		const toExplainBounding = this.step.elementToExplain.getBoundingClientRect();

		switch (this.step.explanationBoxLocation) {
			case ExplanationBoxLoc.Top:
				this.yPos = toExplainBounding.top - (this.tutorialWindow.nativeElement.offsetHeight + 20);
				this.tutorialWindow.nativeElement.classList.add('top');
				break;
			case ExplanationBoxLoc.Left:
				this.xPos = toExplainBounding.left - 340;
				this.tutorialWindow.nativeElement.classList.add('left');
				break;
			case ExplanationBoxLoc.Bottom:
				this.yPos = toExplainBounding.top + toExplainBounding.height + 20;
				this.tutorialWindow.nativeElement.classList.add('bottom');
				break;
			case ExplanationBoxLoc.Right:
				this.xPos = toExplainBounding.left + toExplainBounding.width + 20;
				this.tutorialWindow.nativeElement.classList.add('right');
				break;
		}

		if (this.step.explanationBoxLocation === ExplanationBoxLoc.Left || this.step.explanationBoxLocation === ExplanationBoxLoc.Right) {
			this.yPos = toExplainBounding.top + toExplainBounding.height / 2 - this.tutorialWindow.nativeElement.offsetHeight / 2;
			this.arrowTop = this.tutorialWindow.nativeElement.offsetHeight / 2 - 19;
		} else {
			let desiredPos = toExplainBounding.left + toExplainBounding.width / 2 - this.tutorialWindow.nativeElement.offsetWidth / 2;
			if (desiredPos < 0) {
				desiredPos = 5;
			} else if (desiredPos > window.innerWidth - 320) {
				desiredPos = window.innerWidth - 325;
			}
			this.arrowLeft = toExplainBounding.left + toExplainBounding.width / 2 - desiredPos - 19;
			this.xPos = desiredPos;
		}
		this.cdr.detectChanges();
	}

	public get currentTheme() {
		return this.theming.currentTheme;
	}

	public skipClick() {
		this.skip.emit();
	}

	public nextClick() {
		this.next.emit();
	}

	private set xPos(pos: number) {
		this.tutorialWindow.nativeElement.style.left = pos + 'px';
	}

	private set yPos(pos: number) {
		this.tutorialWindow.nativeElement.style.top = pos + 'px';
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}

}
