/*
 * Public API surface of @logigator/ui.
 *
 * Components, directives, and services are re-exported here as they are built
 * out (see plans/logigator-ui.md). Consumers `import { … } from '@logigator/ui'`;
 * the bundler tree-shakes everything unused ("sideEffects": false).
 */

export const LOGIGATOR_UI_VERSION = '0.0.0';

export type { IconSlot } from './internal/icon';
export type { LgSeverity } from './tokens/severity';
export type { LgSize } from './tokens/size';

export { LgButton } from './button/button';
export { LgDivider } from './divider/divider';
export { LgTag } from './tag/tag';
export { LgBadge } from './badge/badge';
export { LgAvatar } from './avatar/avatar';
export { LgCard } from './card/card';
export { LgRipple } from './ripple/ripple';
