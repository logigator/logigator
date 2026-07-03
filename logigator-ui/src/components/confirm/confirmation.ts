import { LgSeverity } from '../../tokens/severity';

/** The subset of button props a confirmation footer button accepts. */
export interface ConfirmButtonProps {
  severity?: LgSeverity;
  outlined?: boolean;
}

/**
 * A confirmation request handed to {@link ConfirmationService.confirm}. A
 * `key` routes it to the matching outlet: `'inline'` (or any key) to a
 * `<lg-confirm-popup [key]>` anchored at `target`; no key to the keyless
 * `<lg-confirm-dialog>` modal. Resolution is accept-callback only.
 */
export interface Confirmation {
  message?: string;
  header?: string;
  key?: string;
  /** Anchor element for the popup variant (the event's `currentTarget`). */
  target?: EventTarget | HTMLElement | null;
  accept?: () => void;
  reject?: () => void;
  acceptLabel?: string;
  rejectLabel?: string;
  acceptButtonProps?: ConfirmButtonProps;
  rejectButtonProps?: ConfirmButtonProps;
}
