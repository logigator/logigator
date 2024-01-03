// @ts-strict-ignore
import {
	AfterViewInit,
	Component,
	ElementRef,
	OnDestroy,
	ViewChild
} from '@angular/core';
import { PopupContentComp } from '../../popup/popup-content-comp';
import {
	FormControl,
	UntypedFormArray,
	UntypedFormBuilder,
	UntypedFormGroup
} from '@angular/forms';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Project } from '../../../classes/project/project';

@Component({
	selector: 'app-edit-component-plugs',
	templateUrl: './edit-component-plugs.component.html',
	styleUrls: ['./edit-component-plugs.component.scss']
})
export class EditComponentPlugsComponent
	extends PopupContentComp<Project, never>
	implements OnDestroy, AfterViewInit
{
	public inputLabelsForm: UntypedFormGroup;
	public outputLabelsForm: UntypedFormGroup;

	private _inputPlugs: Element[];
	private _outputPlugs: Element[];

	private _currentlyDragging: 'input' | 'output';
	private _dragStart: number;
	private _dragElement: {
		element: HTMLElement;
		pos: number;
		adjustment: number;
	};

	protected _destroySubject = new Subject<void>();

	private _inputStates: {
		element: HTMLElement;
		pos: number;
		adjustment: number;
	}[] = [];

	private _outputStates: {
		element: HTMLElement;
		pos: number;
		adjustment: number;
	}[] = [];

	@ViewChild('compInputs', { static: true })
	private _compInputs: ElementRef<HTMLFormElement>;

	@ViewChild('compOutputs', { static: true })
	private _compOutputs: ElementRef<HTMLFormElement>;

	constructor(
		private formBuilder: UntypedFormBuilder,
	) {
		super();
	}

	ngAfterViewInit() {
		for (const child of this._compInputs.nativeElement
			.children as unknown as HTMLElement[]) {
			this._inputStates.push({
				element: child,
				pos: child.offsetTop,
				adjustment: 0
			});
		}

		for (const child of this._compOutputs.nativeElement
			.children as unknown as HTMLElement[]) {
			this._outputStates.push({
				element: child,
				pos: child.offsetTop,
				adjustment: 0
			});
		}

		fromEvent(window, 'mouseup')
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => this.mouseUp());

		fromEvent(window, 'mousemove')
			.pipe(takeUntil(this._destroySubject))
			.subscribe((e: MouseEvent) => this.mouseMove(e));
	}

	public get inputLabelsControls(): FormControl[] {
		return (this.inputLabelsForm.controls['labels'] as UntypedFormArray)
			.controls as FormControl[];
	}

	public get outputLabelsControls(): FormControl[] {
		return (this.outputLabelsForm.controls['labels'] as UntypedFormArray)
			.controls as FormControl[];
	}

	mouseDown(
		event: MouseEvent,
		control: HTMLDivElement,
		column: 'input' | 'output'
	) {
		if (event.button !== 0) return;
		event.preventDefault();
		this._currentlyDragging = column;
		this._dragStart = event.clientY;

		this._dragElement =
			this._inputStates.find((x) => x.element === control) ||
			this._outputStates.find((x) => x.element === control);
		this._dragElement.element.style.transitionDuration = '0s';
	}

	mouseUp() {
		if (this._currentlyDragging) {
			this._dragElement.element.style.transitionDuration = '';
			const states =
				this._currentlyDragging === 'input'
					? this._inputStates
					: this._outputStates;
			for (const child of states) {
				child.adjustment = Math.round(
					Number(child.element.style.top.replace('px', '') || '0') /
						child.element.offsetHeight
				);
			}
			this._dragElement.adjustment = Math.min(
				this._dragElement.adjustment,
				states.length -
					1 -
					this._dragElement.pos / this._dragElement.element.offsetHeight
			);
			this._dragElement.element.style.top =
				this._dragElement.adjustment * this._dragElement.element.offsetHeight +
				'px';
			this._currentlyDragging = undefined;
		}
	}

	mouseMove(e: MouseEvent) {
		if (this._currentlyDragging) {
			const adjustment =
				this._dragElement.adjustment * this._dragElement.element.offsetHeight;
			const offset = e.clientY - this._dragStart + adjustment;

			if (
				offset +
					this._dragElement.pos +
					this._dragElement.element.offsetHeight >
				this._compInputs.nativeElement.offsetHeight
			)
				return;
			else if (offset + this._dragElement.pos < 0) return;

			this._dragElement.element.style.top = offset + 'px';

			for (const child of this._currentlyDragging === 'input'
				? this._inputStates
				: this._outputStates) {
				if (child === this._dragElement) continue;

				const pos = child.pos + child.adjustment * child.element.offsetHeight;

				if (
					pos + child.element.offsetHeight / 2 <=
						this._dragElement.pos + adjustment &&
					pos + child.element.offsetHeight / 2 >
						this._dragElement.element.offsetTop
				) {
					child.element.style.top =
						this._dragElement.element.offsetHeight +
						child.adjustment * child.element.offsetHeight +
						'px';
				} else if (
					pos - child.element.offsetHeight / 2 >
						this._dragElement.pos + adjustment &&
					pos - child.element.offsetHeight / 2 <=
						this._dragElement.element.offsetTop
				) {
					child.element.style.top =
						-this._dragElement.element.offsetHeight +
						child.adjustment * child.element.offsetHeight +
						'px';
				} else {
					child.element.style.top =
						child.adjustment * child.element.offsetHeight + 'px';
				}
			}
		}
	}

	onChange(event: KeyboardEvent) {
		return event.key !== ',';
	}

	public save() {
		// const sorted = [
		// 	...this._inputStates
		// 		.map((x, i) => [
		// 			x,
		// 			this._inputPlugs[i],
		// 			this.inputLabelsForm.value.labels[i]
		// 		])
		// 		.sort((a, b) => a[0].element.offsetTop - b[0].element.offsetTop),
		// 	...this._outputStates
		// 		.map((x, i) => [
		// 			x,
		// 			this._outputPlugs[i],
		// 			this.outputLabelsForm.value.labels[i]
		// 		])
		// 		.sort((a, b) => a[0].element.offsetTop - b[0].element.offsetTop)
		// ];
		// this.inputFromOpener.setPlugConfiguration(
		// 	sorted.map((x) => x[1].id),
		// 	sorted.map((x) => x[2])
		// );
		// this.projectsService.labelsCustomComponentChanged(this.inputFromOpener);
		this.requestClose.emit();
	}

	ngOnDestroy(): void {
		this._destroySubject.next(null);
		this._destroySubject.complete();
	}
}
