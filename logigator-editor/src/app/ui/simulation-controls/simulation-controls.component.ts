import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDivider,
  LgInputText,
  LgSelect,
  LgTooltip
} from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  SimulationService,
  TargetSpeedUnit
} from '../../simulation/simulation.service';
import { SiPipe } from '../../utils/si/si.pipe';
import { OnboardTargetDirective } from '../../onboarding/onboard-target.directive';

/**
 * The run controls shared by the desktop tool bar and the mobile sim bar:
 * play/pause/step/stop, target-speed input + unit, sync toggle, Hz/tick
 * readout. Driven entirely by SimulationService — no inputs/outputs — so both
 * surfaces stay in lockstep. Exit/enter live in the surrounding chrome.
 */
@Component({
  selector: 'app-simulation-controls',
  imports: [
    FormsModule,
    LgButton,
    LgDivider,
    LgInputText,
    LgSelect,
    LgTooltip,
    SiPipe,
    TranslocoDirective,
    OnboardTargetDirective
  ],
  templateUrl: './simulation-controls.component.html'
})
export class SimulationControlsComponent {
  private readonly simulationService = inject(SimulationService);

  /**
   * Desktop tool bar wraps the controls onto multiple rows when space is tight;
   * the mobile sim bar instead lays them out as a single intrinsic-width row so
   * its `overflow-x-auto` container scrolls cleanly rather than line-breaking.
   */
  public readonly wrap = input(true);

  protected isSimReady = this.simulationService.isReady;
  protected isSimRunning = this.simulationService.isRunning;
  protected simMode = this.simulationService.mode;
  protected targetValue = this.simulationService.targetValue;
  protected targetUnit = this.simulationService.targetUnit;
  protected readonly targetUnitOptions: {
    label: string;
    value: TargetSpeedUnit;
  }[] = [
    { label: 'Hz', value: 'Hz' },
    { label: 'kHz', value: 'kHz' },
    { label: 'MHz', value: 'MHz' }
  ];
  protected measuredHz = this.simulationService.measuredHz;
  protected simTick = this.simulationService.tick;

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

  protected toggleTargetMode(): void {
    this.simulationService.toggleTargetMode();
  }

  protected toggleSyncMode(): void {
    this.simulationService.toggleSyncMode();
  }

  protected onTargetValueInput(event: Event): void {
    this.simulationService.setTargetValue(
      Number((event.target as HTMLInputElement).value)
    );
  }

  protected onTargetUnitChange(unit: TargetSpeedUnit): void {
    this.simulationService.setTargetUnit(unit);
  }
}
