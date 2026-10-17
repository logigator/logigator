import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { ComponentConfig } from './component-config.model';
import { ComponentCategory } from '@logigator/core';
import { LoggingService } from '../logging/logging.service';
import { notComponentConfig } from './component-types/not/not.config';
import { andComponentConfig } from './component-types/and/and.config';
import { orComponentConfig } from './component-types/or/or.config';
import { xorComponentConfig } from './component-types/xor/xor.config';
import { delayComponentConfig } from './component-types/delay/delay.config';
import { clockComponentConfig } from './component-types/clock/clock.config';
import { tunnelComponentConfig } from './component-types/tunnel/tunnel.config';
import { halfAdderComponentConfig } from './component-types/half-adder/half-adder.config';
import { fullAdderComponentConfig } from './component-types/full-adder/full-adder.config';
import { romComponentConfig } from './component-types/rom/rom.config';
import { dFfComponentConfig } from './component-types/d-ff/d-ff.config';
import { jkFfComponentConfig } from './component-types/jk-ff/jk-ff.config';
import { srFfComponentConfig } from './component-types/sr-ff/sr-ff.config';
import { rngComponentConfig } from './component-types/rng/rng.config';
import { ramComponentConfig } from './component-types/ram/ram.config';
import { decoderComponentConfig } from './component-types/decoder/decoder.config';
import { encoderComponentConfig } from './component-types/encoder/encoder.config';
import { muxComponentConfig } from './component-types/mux/mux.config';
import { demuxComponentConfig } from './component-types/demux/demux.config';
import { textComponentConfig } from './component-types/text/text.config';
import { inputComponentConfig } from './component-types/input/input.config';
import { outputComponentConfig } from './component-types/output/output.config';
import { buttonComponentConfig } from './component-types/button/button.config';
import { pulseButtonComponentConfig } from './component-types/pulse-button/pulse-button.config';
import { switchComponentConfig } from './component-types/switch/switch.config';
import { ledComponentConfig } from './component-types/led/led.config';
import { segmentDisplayComponentConfig } from './component-types/segment-display/segment-display.config';
import { ledMatrixComponentConfig } from './component-types/led-matrix/led-matrix.config';
import { gamepadComponentConfig } from './component-types/gamepad/gamepad.config';
import { keyboardComponentConfig } from './component-types/keyboard/keyboard.config';

/**
 * Every built-in's config. A function rather than a module-level array: a
 * config's own imports (its inspection's renderer and the services that one
 * injects) can lead back here, and a list built while such a config module is
 * still loading would hold `undefined` for it. Read at construction, every
 * module has finished loading.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const builtInComponents = (): ComponentConfig<any>[] => [
  notComponentConfig,
  andComponentConfig,
  orComponentConfig,
  xorComponentConfig,
  delayComponentConfig,
  clockComponentConfig,
  tunnelComponentConfig,
  halfAdderComponentConfig,
  fullAdderComponentConfig,
  romComponentConfig,
  dFfComponentConfig,
  jkFfComponentConfig,
  srFfComponentConfig,
  rngComponentConfig,
  ramComponentConfig,
  decoderComponentConfig,
  encoderComponentConfig,
  muxComponentConfig,
  demuxComponentConfig,
  textComponentConfig,
  inputComponentConfig,
  outputComponentConfig,
  switchComponentConfig,
  buttonComponentConfig,
  pulseButtonComponentConfig,
  ledComponentConfig,
  segmentDisplayComponentConfig,
  ledMatrixComponentConfig,
  gamepadComponentConfig,
  keyboardComponentConfig
];

@Injectable({
  providedIn: 'root'
})
export class ComponentProviderService {
  // Keyed by numeric type id, not the closed `ComponentType` enum, so
  // runtime-allocated custom configs register alongside built-ins. A signal so
  // the category lists below update on register/unregister.
  private readonly _configs = signal<ReadonlyMap<number, ComponentConfig>>(
    new Map(builtInComponents().map((config) => [config.type, config]))
  );

  private readonly logging = inject(LoggingService);

  public readonly basicComponents = this._categorySignal(
    ComponentCategory.BASIC
  );
  public readonly advancedComponents = this._categorySignal(
    ComponentCategory.ADVANCED
  );
  public readonly ioComponents = this._categorySignal(ComponentCategory.IO);
  public readonly portComponents = this._categorySignal(ComponentCategory.PORT);
  public readonly userComponents = this._categorySignal(ComponentCategory.USER);

  /** Every registered type, hidden ones included. */
  public readonly allComponents = computed(() => [...this._configs().values()]);

  public getComponent(type: number): ComponentConfig | undefined {
    return this._configs().get(type);
  }

  public register(config: ComponentConfig): void {
    this.logging.debug(
      `register type ${config.type} (category ${config.category})`,
      'ComponentProviderService'
    );
    this._configs.update((configs) =>
      new Map(configs).set(config.type, config)
    );
  }

  public unregister(typeId: number): void {
    this.logging.debug(
      `unregister type ${typeId} (category ${this._configs().get(typeId)?.category})`,
      'ComponentProviderService'
    );
    this._configs.update((configs) => {
      if (!configs.has(typeId)) return configs;
      const next = new Map(configs);
      next.delete(typeId);
      return next;
    });
  }

  private _categorySignal(
    category: ComponentCategory
  ): Signal<ComponentConfig[]> {
    return computed(() =>
      [...this._configs().values()].filter(
        (config) => config.category === category
      )
    );
  }
}
