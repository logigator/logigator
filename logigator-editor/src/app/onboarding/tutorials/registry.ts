import { TutorialDefinition } from '../tutorial.model';
import { gettingStartedTutorial } from './getting-started.tutorial';

/** Tutorial definitions keyed by id. */
export const TUTORIALS: Readonly<Record<string, TutorialDefinition>> = {
  [gettingStartedTutorial.id]: gettingStartedTutorial
};
