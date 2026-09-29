import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDivider,
  LgInputText,
  LgPopover,
  LgSlider,
  LgTooltip
} from '@logigator/ui';
import { SimulationService } from '../../simulation/simulation.service';
import { SimulationRunMode } from '../../simulation/worker/simulation-worker.service';
import { OnboardTargetDirective } from '../../onboarding/onboard-target.directive';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { TranslationKey } from '../../translation/translation-key.model';
import {
  formatHz,
  nearestStopIndex,
  parseSpeed,
  SPEED_STOPS
} from './sim-speed';

const MODE_ICONS: Record<SimulationRunMode, string> = {
  sync: 'ph ph-monitor-play',
  target: 'ph ph-gauge',
  continuous: 'ph ph-lightning'
};

/** Clocks listed by rate before the rest collapse into a count. */
const MAX_CLOCK_ROWS = 3;

/**
 * Fixed speeds below this are not measured: any board keeps up with them, and
 * the one-second status sample of a slower rate only reads as jitter.
 */
const MIN_MEASURED_HZ = 10;

/** A fixed-speed run measured below this share of its target is behind. */
const BEHIND_RATIO = 0.9;

/**
 * The run controls shared by the desktop tool bar and the mobile sim bar.
 * Driven entirely by SimulationService, with no inputs or outputs, so both
 * surfaces stay in lockstep. Exit and enter live in the surrounding chrome.
 *
 * Pacing is one chip naming the current setting, opening a popover that
 * explains the three modes and holds the fixed speed's slider and field.
 */
@Component({
  selector: 'app-simulation-controls',
  imports: [
    FormsModule,
    LgButton,
    LgDivider,
    LgInputText,
    LgPopover,
    LgSlider,
    LgTooltip,
    TranslateDirective,
    OnboardTargetDirective
  ],
  templateUrl: './simulation-controls.component.html'
})
export class SimulationControlsComponent {
  private readonly simulationService = inject(SimulationService);
  private readonly lang = inject(TranslationService).activeLang;

  /**
   * The desktop tool bar wraps the controls when space is tight; the mobile sim
   * bar keeps one intrinsic-width row so its `overflow-x-auto` container
   * scrolls rather than line-breaking.
   */
  public readonly wrap = input(true);

  protected readonly isSimReady = this.simulationService.isReady;
  protected readonly isSimRunning = this.simulationService.isRunning;
  protected readonly simMode = this.simulationService.mode;
  protected readonly simTick = this.simulationService.tick;
  private readonly targetHz = this.simulationService.targetHz;
  private readonly measuredHz = this.simulationService.measuredHz;

  protected readonly modeIcons = MODE_ICONS;
  protected readonly modeOptions = [
    {
      mode: 'sync',
      label: 'toolBar.speedFrame',
      hint: 'toolBar.speedFrameHint'
    },
    {
      mode: 'target',
      label: 'toolBar.speedFixed',
      hint: 'toolBar.speedFixedHint'
    },
    {
      mode: 'continuous',
      label: 'toolBar.speedMax',
      hint: 'toolBar.speedMaxHint'
    }
  ] as const satisfies readonly {
    mode: SimulationRunMode;
    label: TranslationKey;
    hint: TranslationKey;
  }[];
  protected readonly lastStop = SPEED_STOPS.length - 1;
  protected readonly stopIndex = computed(() =>
    nearestStopIndex(this.targetHz())
  );
  protected readonly targetLabel = computed(() =>
    formatHz(this.targetHz(), this.lang())
  );

  // What is being typed, kept until the field is left so a keystroke that
  // parses is never reformatted under the caret.
  private readonly draft = signal<string | null>(null);
  protected readonly fieldText = computed(
    () => this.draft() ?? this.targetLabel()
  );
  protected readonly fieldInvalid = computed(() => {
    const draft = this.draft();
    return draft !== null && parseSpeed(draft) === null;
  });

  private readonly measuring = computed(
    () =>
      this.isSimRunning() &&
      this.measuredHz() > 0 &&
      (this.simMode() !== 'target' || this.targetHz() >= MIN_MEASURED_HZ)
  );
  protected readonly measuredLabel = computed(() =>
    this.measuring() ? formatHz(this.measuredHz(), this.lang()) : null
  );
  protected readonly isBehind = computed(
    () =>
      this.measuring() &&
      this.simMode() === 'target' &&
      this.measuredHz() < BEHIND_RATIO * this.targetHz()
  );

  // The rate the clocks divide: the one asked for when fixed, otherwise the
  // one measured, which is unknown until a run has been sampled.
  private readonly tickRate = computed(() => {
    if (this.simMode() === 'target') {
      return this.targetHz();
    }
    return this.isSimRunning() && this.measuredHz() > 0
      ? this.measuredHz()
      : null;
  });
  protected readonly clockRows = computed(() => {
    const rate = this.tickRate();
    if (rate === null) {
      return [];
    }
    return this.simulationService
      .clockHalfPeriods()
      .slice(0, MAX_CLOCK_ROWS)
      .map((delay) => ({
        delay,
        frequency: formatHz(rate / (2 * delay), this.lang())
      }));
  });
  protected readonly hiddenClocks = computed(() =>
    Math.max(
      0,
      this.simulationService.clockHalfPeriods().length - MAX_CLOCK_ROWS
    )
  );

  protected playSimulation(): void {
    this.simulationService.play();
  }

  protected pauseSimulation(): void {
    this.simulationService.pause();
  }

  protected stepSimulation(): void {
    this.simulationService.step();
  }

  protected stopSimulation(): void {
    this.simulationService.stop();
  }

  protected setMode(mode: SimulationRunMode): void {
    this.simulationService.setMode(mode);
  }

  protected onStopChange(index: number): void {
    this.draft.set(null);
    this.simulationService.setTargetHz(SPEED_STOPS[index]);
  }

  protected onFieldInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.draft.set(text);
    const hz = parseSpeed(text);
    if (hz !== null) {
      this.simulationService.setTargetHz(hz);
    }
  }

  protected onFieldCommit(): void {
    this.draft.set(null);
  }
}
