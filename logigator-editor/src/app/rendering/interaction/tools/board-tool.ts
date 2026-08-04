import { Project } from '../../../project/project';
import { DragSession } from '../../drag-session';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { PointerInput } from '../pointer-input';

/**
 * What a tool may ask of the router that dispatches to it: open a session,
 * and read the interaction context an async tool (the placement load) must
 * re-validate before opening one.
 */
export interface ToolHost {
  readonly project: Project | null;
  readonly mode: WorkMode;
  readonly hasActiveSession: boolean;
  /**
   * Monotonic gesture stamp: the router bumps it on pointer-up, cancel and
   * context switches. An async tool captures the value when its gesture
   * starts (via {@link bumpGestureSeq}) and opens its session only while the
   * stamp is unchanged — a stale load must not open a session with no
   * pointer left to drive it.
   */
  readonly gestureSeq: number;
  bumpGestureSeq(): number;
  /** Opens a session for the active gesture; the router owns its lifecycle. */
  startSession(session: DragSession): void;
}

/**
 * One work mode's canvas behavior: what a primary press opens and what a
 * bare hover previews. Tools are stateless between gestures except for their
 * own hover previews, which {@link deactivate} tears down whenever the tool's
 * context ends (mode/project switch, pointer leaving the canvas).
 */
export interface BoardTool {
  /** A primary press landed; open a session via the host, or do nothing. */
  down(project: Project, input: PointerInput, host: ToolHost): void;
  /** Pointer moved with no pressed pointer owning it — update previews. */
  hover?(project: Project, input: PointerInput, host: ToolHost): void;
  /** The tool's context ended — tear down any hover previews on `project`. */
  deactivate?(project: Project): void;
  /** A session took over the canvas — previews yield to its ghosts. */
  onSessionStart?(): void;
}
