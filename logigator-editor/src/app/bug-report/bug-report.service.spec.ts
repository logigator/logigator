import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { BugReportService } from './bug-report.service';
import { ClientInfoService } from './client-info.service';
import { ReportErrorApiService } from '../api/services/report-error-api.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectDumpService } from '../persistence/dump/project-dump.service';
import { ProjectService } from '../project/project.service';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';
import type { ReportErrorRequest } from '../api/models/report-error';

/** Lets the awaited `onClose` promise (and its follow-on submit) settle. */
const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve));

describe('BugReportService', () => {
  let service: BugReportService;
  let onClose$: Subject<string | undefined>;
  let open: Mock;
  let report: Mock;
  let now: number;

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    onClose$ = new Subject();
    open = vi.fn().mockReturnValue({ onClose: onClose$ });
    report = vi.fn().mockReturnValue(of({ success: true }));

    TestBed.configureTestingModule({
      providers: [
        BugReportService,
        { provide: DialogService, useValue: { open } },
        {
          provide: TranslationService,
          useValue: { translate: (key: string) => key }
        },
        { provide: ReportErrorApiService, useValue: { report } },
        {
          provide: PersistenceService,
          useValue: { exportProjectToJson: () => '{}' }
        },
        {
          provide: ProjectDumpService,
          useValue: { buildDump: () => ({ dumpVersion: 1 }) }
        },
        { provide: ProjectService, useValue: { activeProject: () => ({}) } },
        {
          provide: ClientInfoService,
          useValue: { collect: () => ({ browser: 'TestBrowser' }) }
        },
        {
          provide: LoggingService,
          useValue: { error: vi.fn(), warn: vi.fn(), recentLogs: () => '' }
        },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn() }
        }
      ]
    });
    service = TestBed.inject(BugReportService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('opens the dialog once and swallows cascading errors while it is open', () => {
    service.handleUncaughtError(new Error('first'));
    service.handleUncaughtError(new Error('cascade'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the dialog is dismissed', async () => {
    service.handleUncaughtError(new Error('boom'));
    onClose$.next(undefined);
    onClose$.complete();
    await flush();
    expect(report).not.toHaveBeenCalled();
  });

  it('submits a full payload when the user sends the report', async () => {
    service.handleUncaughtError(new Error('kaboom'));
    onClose$.next('here is what happened');
    onClose$.complete();
    await flush();

    expect(report).toHaveBeenCalledTimes(1);
    const payload = report.mock.calls[0][0] as ReportErrorRequest;
    expect(payload.source).toBe('editor-v2');
    expect(payload.userMessage).toBe('here is what happened');
    expect(payload.message).toBe('kaboom');
    expect(payload.stack).toContain('kaboom');
    expect(payload.client?.browser).toBe('TestBrowser');
    expect(payload.projectDump).toBe(JSON.stringify({ dumpVersion: 1 }));
  });

  it('reopens for a new error only once the cooldown elapses', async () => {
    service.handleUncaughtError(new Error('one'));
    onClose$.next(undefined);
    onClose$.complete();
    await flush();

    onClose$ = new Subject();
    open.mockReturnValue({ onClose: onClose$ });

    now += 1000; // still inside the 15s cooldown
    service.handleUncaughtError(new Error('two'));
    expect(open).toHaveBeenCalledTimes(1);

    now += 15000; // past the cooldown
    service.handleUncaughtError(new Error('three'));
    expect(open).toHaveBeenCalledTimes(2);
  });
});
