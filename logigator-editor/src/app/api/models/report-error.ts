import type { ProjectElement } from '@logigator/core';

// ---- POST /api/report-error request ----

export interface ReportErrorRequest {
  /** Which client sent the report; the newer editor sends `editor-v2`. */
  source?: string;
  /** Links this report to the matching PostHog `$exception` event, which
   * carries the same id under `correlation_id`. */
  correlationId?: string;
  line?: number;
  col?: number;
  file?: string;
  userAgent?: string;
  message?: string;
  stack?: string;
  userMessage?: string;
  /** Structured client environment (browser, OS, renderer, app state). */
  client?: ReportClientInfo;
  /** Recent client-side log lines leading up to the report. */
  logs?: string;
  /** Serialized native project dump, sent as an opaque JSON string. */
  projectDump?: string;
  /** Legacy positional project payload; unused by the newer editor. */
  project?: ReportProject;
}

export interface ReportClientInfo {
  browser?: string;
  os?: string;
  renderingContext?: string;
  gpu?: string;
  windowWidth?: number;
  windowHeight?: number;
  screenWidth?: number;
  screenHeight?: number;
  devicePixelRatio?: number;
  locale?: string;
  url?: string;
  workMode?: string;
  simulationRunning?: boolean;
  touch?: boolean;
}

export interface ReportProject {
  project: {
    name: string;
    elements: ProjectElement[];
  };
  components: ReportComponentEntry[];
}

export interface ReportComponentEntry {
  info: {
    id: number;
    numInputs: number;
    numOutputs: number;
    labels: string[];
    name: string;
    description: string;
    symbol: string;
  };
  elements: ProjectElement[];
}
