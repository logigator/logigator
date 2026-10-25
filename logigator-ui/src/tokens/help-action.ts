/**
 * A header's help button, drawn beside its close button: `label` is the
 * button's accessible name and tooltip, `command` what a click does. Both are
 * the consumer's, so the library adds no words and no destination of its own.
 */
export interface LgHelpAction {
  label: string;
  command: () => void;
}
