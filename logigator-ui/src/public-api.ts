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
export type { MenuItem, MenuItemCommandEvent } from './menu/menu-item.model';
export type { LgPaginatorState } from './paginator/paginator';
export type { LgFileSelectEvent } from './file-upload/file-upload';

export { LgButton } from './button/button';
export { LgDivider } from './divider/divider';
export { LgTag } from './tag/tag';
export { LgBadge } from './badge/badge';
export { LgAvatar } from './avatar/avatar';
export { LgCard } from './card/card';
export { LgRipple } from './ripple/ripple';

export { LgInputText } from './input-text/input-text';
export { LgTextarea } from './textarea/textarea';
export { LgToggleSwitch } from './toggle-switch/toggle-switch';
export { LgSelectButton } from './select-button/select-button';
export { LgInputNumber } from './input-number/input-number';
export { LgSlider } from './slider/slider';

export { LgTooltip } from './tooltip/tooltip';
export { LgPopover } from './popover/popover';
export { LgSelect } from './select/select';
export { LgDialog } from './dialog/dialog';
export { LgDrawer } from './drawer/drawer';

export { LgAccordion, LgAccordionPanel } from './accordion/accordion';
export { LgTabs, LgTab, LgTabPanel } from './tabs/tabs';
export { LgPanelMenu } from './panel-menu/panel-menu';
export { LgMenu } from './menu/menu';
export { LgMenubar } from './menu/menubar';
export { LgPaginator } from './paginator/paginator';
export { LgFileUpload } from './file-upload/file-upload';
export { LgScroller } from './scroller/scroller';

export { DialogService } from './dynamic-dialog/dialog.service';
export { DialogRef } from './dynamic-dialog/dialog-ref';
export { DialogConfig } from './dynamic-dialog/dialog-config';

export { ConfirmationService } from './confirm/confirmation.service';
export { LgConfirmDialog } from './confirm/confirm-dialog';
export { LgConfirmPopup } from './confirm/confirm-popup';
export type { Confirmation, ConfirmButtonProps } from './confirm/confirmation';
