import type { ProjectElement } from './project-element';

// ---- POST /api/report-error request ----

export interface ReportErrorRequest {
  line?: number;
  col?: number;
  file?: string;
  userAgent?: string;
  message?: string;
  stack?: string;
  userMessage?: string;
  project?: ReportProject;
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
