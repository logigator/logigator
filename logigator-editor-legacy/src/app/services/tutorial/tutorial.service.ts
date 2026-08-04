// @ts-strict-ignore
import {
	ApplicationRef,
	ComponentFactoryResolver,
	ComponentRef,
	EmbeddedViewRef,
	Inject,
	Injectable,
	Injector
} from '@angular/core';
import { TutorialWindowComponent } from '../../components/tutorial-window/tutorial-window.component';
import {
	StorageService,
	StorageServiceModel
} from '../storage/storage.service';
import { Tutorial } from '../../models/tutorial';
import { gettingStarted } from '../../models/tutorials/gettingStarted';
import { Subscription } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class TutorialService {
	private _tutorials = new Map<string, Tutorial>([
		[gettingStarted.id, gettingStarted]
	]);

	private readonly _finishedTutorials: Set<string>;

	private _currentRunningTutorial: string;

	private _tutorialStepPointer: number;

	private _tutWindowInstance: ComponentRef<TutorialWindowComponent>;
	private _skipSubscription: Subscription;
	private _nextSubscription: Subscription;

	constructor(
		private componentFactoryResolver: ComponentFactoryResolver,
		private appRef: ApplicationRef,
		private injector: Injector,
		@Inject(StorageService) private storage: StorageServiceModel
	) {
		const data = this.storage.get('tutorials');
		this._finishedTutorials = data ? new Set<string>(data) : new Set<string>();
	}

	public get allTutorials(): Tutorial[] {
		return [...this._tutorials.values()];
	}

	public startTutorial(tutorialName: string) {
		if (!this._finishedTutorials.has(tutorialName))
			this.manuallyStartTutorial(tutorialName);
	}

	public manuallyStartTutorial(tutorialName: string) {
		if (this._currentRunningTutorial) return;

		this._currentRunningTutorial = tutorialName;
		this._tutorialStepPointer = 0;
		const compFactory = this.componentFactoryResolver.resolveComponentFactory(
			TutorialWindowComponent
		);
		this._tutWindowInstance = compFactory.create(this.injector);
		this._skipSubscription = this._tutWindowInstance.instance.skip.subscribe(
			() => {
				this.finishTutorial();
			}
		);
		this._nextSubscription = this._tutWindowInstance.instance.next.subscribe(
			() => {
				if (
					this._tutorials.get(this._currentRunningTutorial).steps.length - 1 ===
					this._tutorialStepPointer
				) {
					this.finishTutorial();
				} else {
					this._tutorialStepPointer++;
					this.tutorialStep();
				}
			}
		);
		this.appRef.attachView(this._tutWindowInstance.hostView);
		const domElem = (
			this._tutWindowInstance.hostView as EmbeddedViewRef<unknown>
		).rootNodes[0] as HTMLElement;
		document.body.appendChild(domElem);
		this.tutorialStep();
	}

	private tutorialStep() {
		const tutorial = this._tutorials.get(this._currentRunningTutorial);
		this._tutWindowInstance.instance.step = {
			...tutorial.steps[this._tutorialStepPointer],
			elementToExplain: document.querySelector(
				tutorial.steps[this._tutorialStepPointer].elementToExplain
			) as HTMLElement
		};
		this._tutWindowInstance.instance.isLastStep =
			tutorial.steps.length - 1 === this._tutorialStepPointer;
		this._tutWindowInstance.changeDetectorRef.detectChanges();
		this._tutWindowInstance.instance.elementToExplainChanged();
	}

	private finishTutorial() {
		this._nextSubscription.unsubscribe();
		this._skipSubscription.unsubscribe();
		this._tutWindowInstance.destroy();
		delete this._tutWindowInstance;

		this._finishedTutorials.add(this._currentRunningTutorial);
		this.storage.set('tutorials', [...this._finishedTutorials]);

		delete this._currentRunningTutorial;
	}
}
