import { Type } from '@angular/core';
import { Component } from './component';
import type { Project } from '../project/project';
import type { ComponentConfigView } from './component-config.model';

/**
 * A placement ghost has no instance behind it, so the palette supplies only
 * `config` and leaves `component`/`project` null.
 */
export interface ComponentActionContext {
  config: ComponentConfigView;
  component: Component | null;
  project: Project | null;
}

/**
 * A valueless action attached to a component type — the action analog of
 * {@link ComponentOption}, rendered through `*ngComponentOutlet` exactly as an
 * option is, with a {@link ComponentActionContext}.
 *
 * Each action pairs with its own renderer, which owns its click handling and
 * its visibility, so adding an inspector action touches nothing else. One that
 * needs a live instance gates itself on `context.component`.
 */
export abstract class ComponentAction {
  public abstract readonly renderer: Type<unknown>;
}
