/*
 * Public API surface of @logigator/ui.
 *
 * Components, directives, and services are re-exported here. Consumers
 * `import { … } from '@logigator/ui'`; the bundler tree-shakes everything
 * unused ("sideEffects": false).
 */

export const LOGIGATOR_UI_VERSION = '0.0.0';

export type { IconSlot } from './internal/icon';
export type { LgSeverity } from './tokens/severity';
export type { LgSize } from './tokens/size';
export type {
  MenuItem,
  MenuItemCommandEvent
} from './components/menu/menu-item.model';
export type { LgPaginatorState } from './components/paginator/paginator';
export type { LgFileSelectEvent } from './components/file-upload/file-upload';
export type {
  LgShortcutBinding,
  LgShortcutTone
} from './components/shortcut/shortcut';

export { LgButton } from './components/button/button';
export { LgDivider } from './components/divider/divider';
export { LgTag } from './components/tag/tag';
export { LgBadge } from './components/badge/badge';
export { LgMessage } from './components/message/message';
export { LgMarkdown } from './components/markdown/markdown';
export { LgAvatar } from './components/avatar/avatar';
export { LgCard } from './components/card/card';
export { LgList, LgListItem } from './components/list/list';
export { LgRipple } from './components/ripple/ripple';
export {
  LgShortcut,
  formatShortcutKey,
  formatShortcutLabel
} from './components/shortcut/shortcut';
export { LgIconField } from './components/icon-field/icon-field';
export { LgInputIcon } from './components/icon-field/input-icon';

export { LgInputText } from './components/input-text/input-text';
export { LgTextarea } from './components/textarea/textarea';
export { LgToggleSwitch } from './components/toggle-switch/toggle-switch';
export { LgCheckbox } from './components/checkbox/checkbox';
export { LgSelectButton } from './components/select-button/select-button';
export { LgInputNumber } from './components/input-number/input-number';
export { LgSlider } from './components/slider/slider';

export { LgTooltip } from './components/tooltip/tooltip';
export { LgPopover } from './components/popover/popover';
export { LgSelect } from './components/select/select';
export { LgDialog } from './components/dialog/dialog';
export { LgDrawer } from './components/drawer/drawer';

export {
  LgAccordion,
  LgAccordionPanel
} from './components/accordion/accordion';
export { LgTabs, LgTab, LgTabPanel } from './components/tabs/tabs';
export { LgTabStrip } from './components/tab-strip/tab-strip';
export type {
  LgTabStripItem,
  LgTabReorder
} from './components/tab-strip/tab-strip';
export { LgPanelMenu } from './components/panel-menu/panel-menu';
export { LgNavigation } from './components/navigation/navigation';
export type { NavigationItem } from './components/navigation/navigation-item.model';
export { LgMenu } from './components/menu/menu';
export { LgMenubar } from './components/menu/menubar';
export { LgPaginator } from './components/paginator/paginator';
export { LgFileUpload } from './components/file-upload/file-upload';
export { LgScroller } from './components/scroller/scroller';

export { DialogService } from './components/dynamic-dialog/dialog.service';
export { DialogRef } from './components/dynamic-dialog/dialog-ref';
export {
  DialogConfig,
  type DialogInputs
} from './components/dynamic-dialog/dialog-config';
export {
  LgDialogContent,
  type DialogDataOf,
  type DialogResultOf
} from './components/dynamic-dialog/dialog-content';

export { WindowService } from './components/window/window.service';
export { WindowRef } from './components/window/window-ref';
export { LgWindowOutlet } from './components/window/window-outlet';
export type {
  WindowConfig,
  WindowSize,
  WindowPoint,
  WindowTitlePart
} from './components/window/window-config';

export { ConfirmationService } from './components/confirm/confirmation.service';
export { LgConfirmDialog } from './components/confirm/confirm-dialog';
export { LgConfirmPopup } from './components/confirm/confirm-popup';
export type {
  Confirmation,
  ConfirmButtonProps
} from './components/confirm/confirmation';

export { ToastService } from './components/toast/toast.service';
export { LgToast } from './components/toast/toast';
export type { ToastMessage } from './components/toast/toast.service';

export { LgOverlayService } from './components/overlay/overlay.service';
export { LgCaret } from './internal/caret';
export {
  OVERLAY_GAP,
  connectedPositions,
  caretSideChanges
} from './internal/overlay';
export type {
  LgOverlaySide,
  LgCaretTone,
  LgOverlayPlacement,
  ConnectedOverlayOptions,
  GlobalOverlayOptions
} from './internal/overlay';
