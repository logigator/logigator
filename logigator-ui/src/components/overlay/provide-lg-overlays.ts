import { OVERLAY_DEFAULT_CONFIG } from '@angular/cdk/overlay';
import { Provider } from '@angular/core';

/**
 * Keeps every CDK overlay in `.cdk-overlay-container` instead of a popover.
 *
 * Since CDK 22 an overlay opens as a popover by default, which puts it in the
 * browser's top layer, above any z-index. The library's layering scale
 * (`styles/layers.css`) needs overlays inside their `overlay` band so a toast
 * shows above an open dialog. Provided once per app rather than per
 * `create()`, because overlays are created outside the library too.
 */
export function provideLgOverlays(): Provider[] {
  return [{ provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } }];
}
