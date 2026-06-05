import { Component } from '../../component';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { notComponentConfig, NotOptions } from './not.config';

export class NotComponent extends Component<NotOptions> {
  public readonly config = notComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: NotOptions) {
    super(1, 1, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
  }

  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 2;
  }

  protected draw(): void {
    const componentGraphics = new Graphics(
      this.geometryService.getGraphicsContext(
        ComponentGraphics,
        2,
        Math.max(this.numInputs, this.numOutputs),
        this.appliedScale
      )
    );
    this.addChild(componentGraphics);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
