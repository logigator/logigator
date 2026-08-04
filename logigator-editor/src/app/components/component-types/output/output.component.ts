import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../../component';
import { outputComponentConfig, OutputOptions } from './output.config';

export class OutputComponent extends Component<OutputOptions> {
  public readonly config = outputComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: OutputOptions) {
    // A plug's port counts are fixed: an OUTPUT exposes exactly one input
    // (the signal it draws out of the circuit). The `i`/`o` wire fields are
    // ignored on load — counts come from here, not from the element.
    super(1, 0, options);

    // The label is the body's centred glyph, so a rename needs a rebuild of
    // the visual tree (the port itself is unaffected).
    this.options.label.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.redraw();
      });
  }

  // A 1×1 plug carries its name as the body glyph (see `symbol`), never through
  // the per-stub label path: that path draws labels inside the body, where the
  // glyph already sits, and a non-empty entry here would halve the glyph's slot.
  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 1;
  }

  // The user-set port name takes the body's centre, falling back to the "OUT"
  // glyph while unnamed (legacy-editor behavior). Module-level config: evaluated
  // before the `config` field is assigned.
  protected override get symbol(): string {
    return this.options.label.value || outputComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(1, 1);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
