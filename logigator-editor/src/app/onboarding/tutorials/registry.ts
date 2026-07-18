import { TutorialDefinition } from '../tutorial.model';
import { gettingStartedTutorial } from './getting-started.tutorial';

/** Tutorial definitions keyed by id, resolved by the runner from the active id. */
export const TUTORIALS: Readonly<Record<string, TutorialDefinition>> = {
  [gettingStartedTutorial.id]: gettingStartedTutorial
};
