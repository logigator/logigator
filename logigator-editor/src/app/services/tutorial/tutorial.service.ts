import {
	ComponentFactoryResolver,
	ComponentRef,
	Inject,
	Injectable,
	ViewContainerRef
} from '@angular/core';
import {HelpWindowComponent} from '../../components/help-window/help-window.component';
import {StorageService, StorageServiceModel} from '../storage/storage.service';
import {Tutorial} from '../../models/tutorial';
import {basic} from '../../models/tutorials/basic';
import {Subscription} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class TutorialService {

	private _helpWindowInsertionPoint: ViewContainerRef;

	private _tutorials = new Map<string, Tutorial>([
		[basic.id, basic]
	]);

	private readonly _finishedTutorials: Set<string>;

	private _currentRunningTutorial: string;

	private _tutorialStepPointer: number;

	private _currentlyHighlightedElement: HTMLElement;

	private _helpWindowInstance: ComponentRef<HelpWindowComponent>;
	private _skipSubscription: Subscription;
	private _nextSubscription: Subscription;

	private readonly _tutorialOverlay: HTMLDivElement;

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		@Inject(StorageService) private storage: StorageServiceModel,
	) {
		const data = this.storage.get('tutorials');
		this._finishedTutorials = data ? new Set<string>(data) : new Set<string>();

		this._tutorialOverlay = document.createElement('div');
		this._tutorialOverlay.classList.add('tutorial-overlay');
	}

	public setHelpWindowInsertionPoint(value: ViewContainerRef) {
		this._helpWindowInsertionPoint = value;
	}

	public get allTutorials(): Tutorial[] {
		return [...this._tutorials.values()];
	}

	public startTutorial(tutorialName: string) {
		if (!this._finishedTutorials.has(tutorialName))
			this.manuallyStartTutorial(tutorialName);
	}

	public manuallyStartTutorial(tutorialName: string) {
		if (this._currentRunningTutorial)
			return;

		this._currentRunningTutorial = tutorialName;
		this._tutorialStepPointer = 0;
		const compFactory = this.componentFactoryResolver.resolveComponentFactory(HelpWindowComponent);
		this._helpWindowInstance = this._helpWindowInsertionPoint.createComponent(compFactory);
		this._skipSubscription = this._helpWindowInstance.instance.skip.subscribe(() => {
			this.finishTutorial();
		});
		this._nextSubscription = this._helpWindowInstance.instance.next.subscribe(() => {
			if (this._tutorials.get(this._currentRunningTutorial).steps.length - 1 === this._tutorialStepPointer) {
				this.finishTutorial();
			} else {
				this._tutorialStepPointer++;
				this.tutorialStep();
			}
		});
		this.tutorialStep();
	}

	private tutorialStep() {
		const tutorial = this._tutorials.get(this._currentRunningTutorial);
		this._helpWindowInstance.instance.isLastStep = tutorial.steps.length - 1 === this._tutorialStepPointer;
		this._helpWindowInstance.instance.title = tutorial.steps[this._tutorialStepPointer].title ?? tutorial.name;
		this._helpWindowInstance.instance.text = tutorial.steps[this._tutorialStepPointer].text;

		this.removeElementHighlight();

		if (!tutorial.steps[this._tutorialStepPointer].elementToHighlight)
			return;

		const elementToHighlight = document.querySelector(tutorial.steps[this._tutorialStepPointer].elementToHighlight) as HTMLElement;
		if (!elementToHighlight)
			return;

		this._currentlyHighlightedElement = elementToHighlight;
		this.adjustTutorialOverlay();
		document.body.appendChild(this._tutorialOverlay);
	}

	private finishTutorial() {
		this.removeElementHighlight();
		this._nextSubscription.unsubscribe();
		this._skipSubscription.unsubscribe();
		this._helpWindowInstance.destroy();
		delete this._helpWindowInstance;

		this._finishedTutorials.add(this._currentRunningTutorial);
		this.storage.set('tutorials', [...this._finishedTutorials]);

		delete this._currentRunningTutorial;
	}

	private adjustTutorialOverlay() {
		const elementToHighlightBounding = this._currentlyHighlightedElement.getBoundingClientRect();

		this._tutorialOverlay.style.top = elementToHighlightBounding.top + elementToHighlightBounding.height / 2 + 'px';
		this._tutorialOverlay.style.left = elementToHighlightBounding.left +  elementToHighlightBounding.width / 2 + 'px';
		this._tutorialOverlay.style.width = elementToHighlightBounding.width + 10 + 'px';
		this._tutorialOverlay.style.height = elementToHighlightBounding.height + 10 + 'px';
	}

	private removeElementHighlight() {
		this._tutorialOverlay.remove();
		delete this._currentlyHighlightedElement;
	}
}
