import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, RenderGroup, RenderGroupSystem, Renderer } from 'pixi.js';

/** `render` is protected on the class; it is the entry point exercised here. */
interface RenderGroupPass {
  render(options: { container: Container }): void;
}

/**
 * Holds pixi.js to the local patch (`.yarn/patches/pixi.js-*.patch`): a child
 * render group whose root is culled is neither transformed nor built until it
 * comes back. Stock PixiJS builds every group on every structural change,
 * culled or not, which made the first frame of a large board build the whole
 * board. A failure here after a pixi.js upgrade means the patch was dropped.
 */
describe('RenderGroupSystem (patched): culled child render groups', () => {
  let system: RenderGroupPass;
  let built: Container[];

  beforeEach(() => {
    built = [];
    // `_buildInstructions` is private; its call is what "built" means here.
    vi.spyOn(
      RenderGroupSystem.prototype as unknown as {
        _buildInstructions(group: RenderGroup): void;
      },
      '_buildInstructions'
    ).mockImplementation((group: RenderGroup) => {
      built.push(group.root);
    });
    const renderer = {
      renderPipes: { batch: { upload: () => undefined } },
      globalUniforms: { start: () => undefined }
    } as unknown as Renderer;
    system = new RenderGroupSystem(renderer) as unknown as RenderGroupPass;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** root ⊃ entry ⊃ nested, each its own render group, like the quad tree. */
  function scene() {
    const root = new Container({ isRenderGroup: true });
    const entry = root.addChild(new Container({ isRenderGroup: true }));
    const nested = entry.addChild(new Container({ isRenderGroup: true }));
    const leaf = nested.addChild(new Container());
    return { root, entry, nested, leaf };
  }

  it('skips a culled group and its descendants, then builds them once revealed', () => {
    const { root, entry, nested } = scene();
    entry.culled = true;

    system.render({ container: root });
    expect(built).toEqual([root]);

    built = [];
    entry.culled = false;
    system.render({ container: root });

    expect(built).toContain(entry);
    expect(built).toContain(nested);
  });

  it('never skips the group it was asked to render, culled or not', () => {
    const { root } = scene();
    root.culled = true;

    system.render({ container: root });

    expect(built).toContain(root);
  });

  it('applies a transform change made while culled on the first visit back', () => {
    const { root, entry, leaf } = scene();
    system.render({ container: root });
    entry.culled = true;
    system.render({ container: root });

    leaf.position.set(7, 3);
    system.render({ container: root });
    expect(leaf.relativeGroupTransform.tx).toBe(0);

    entry.culled = false;
    system.render({ container: root });
    expect(leaf.relativeGroupTransform.tx).toBe(7);
    expect(leaf.relativeGroupTransform.ty).toBe(3);
  });
});
