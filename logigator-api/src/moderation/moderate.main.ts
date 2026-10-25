/* Entry point of the `moderate.js` bundle: lists open document reports, hides
   and unhides documents, and resolves reports, then exits.

   An Rspack entry beside `renormalize.js`, booting the application container
   for its database and nothing else. There is no admin role or admin route:
   running this against the database is what being a moderator means.

   eslint-disable no-console: a CLI whose only output channel is the terminal.

   Usage:
     node moderate.js reports
     node moderate.js hide <project|component> <link> --reason "<shown to the owner>"
     node moderate.js unhide <project|component> <link>
     node moderate.js resolve <report-id> --note "<what was done>"
*/
/* eslint-disable no-console */
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/env';
import type { ReportedKind } from '../reports/document-reports.service';
import { ModerationService, type OpenReport } from './moderation.service';

const USAGE = `Usage:
  db:moderate reports
  db:moderate hide <project|component> <link> --reason "<shown to the owner>"
  db:moderate unhide <project|component> <link>
  db:moderate resolve <report-id> --note "<what was done>"`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Command =
  | { name: 'reports' }
  | { name: 'hide'; kind: ReportedKind; link: string; reason: string }
  | { name: 'unhide'; kind: ReportedKind; link: string }
  | { name: 'resolve'; reportId: string; note: string };

/** The command line as a command, or the reason it is not one. */
function parseCommand(argv: string[]): Command | string {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { reason: { type: 'string' }, note: { type: 'string' } },
    allowPositionals: true
  });
  const [name, ...rest] = positionals;

  switch (name) {
    case 'reports':
      return { name };
    case 'hide':
    case 'unhide': {
      const [kind, link] = rest;
      if (kind !== 'project' && kind !== 'component') {
        return 'The kind is `project` or `component`.';
      }
      if (!link || !UUID.test(link)) return 'The link is a uuid.';
      if (name === 'unhide') return { name, kind, link };
      if (!values.reason?.trim()) return '`hide` needs a --reason.';
      return { name, kind, link, reason: values.reason };
    }
    case 'resolve': {
      const [reportId] = rest;
      if (!reportId || !UUID.test(reportId)) return 'The report id is a uuid.';
      if (!values.note?.trim()) return '`resolve` needs a --note.';
      return { name, reportId, note: values.note };
    }
    default:
      return USAGE;
  }
}

async function run(
  moderation: ModerationService,
  command: Command
): Promise<number> {
  switch (command.name) {
    case 'reports': {
      const reports = await moderation.openReports();
      if (reports.length === 0) console.log('No open reports.');
      for (const report of reports) console.log(describe(report));
      return 0;
    }
    case 'hide': {
      const result = await moderation.hide(
        command.kind,
        command.link,
        command.reason
      );
      if (!result) return notFound(command.kind, command.link);
      console.log(
        `Hidden. Resolved ${result.resolvedReports} open report(s) about it.`
      );
      return 0;
    }
    case 'unhide': {
      if (!(await moderation.unhide(command.kind, command.link))) {
        return notFound(command.kind, command.link);
      }
      console.log('Unhidden.');
      return 0;
    }
    case 'resolve': {
      if (!(await moderation.resolve(command.reportId, command.note))) {
        console.error(`No open report ${command.reportId}.`);
        return 1;
      }
      console.log('Resolved.');
      return 0;
    }
  }
}

function describe(report: OpenReport): string {
  const document = report.document
    ? `${report.document.name} (${report.kind} ${report.document.link}, owner ${report.document.ownerId}${report.document.hidden ? ', hidden' : ''})`
    : `deleted ${report.kind} ${report.documentId}`;
  return [
    `Report ${report.id} · ${report.createdAt.toISOString()} · ${report.reason}`,
    `  Document: ${document}`,
    `  Reporter: ${report.reporterId ?? 'not signed in'} · contact ${report.contactEmail ?? 'none'}`,
    ...report.explanation.split('\n').map((line) => `  > ${line}`),
    ''
  ].join('\n');
}

function notFound(kind: ReportedKind, link: string): number {
  console.error(`No ${kind} has the link ${link}.`);
  return 1;
}

async function main(): Promise<number> {
  const command = parseCommand(process.argv.slice(2));
  if (typeof command === 'string') {
    console.error(command);
    return 2;
  }

  const env = loadEnv(process.env);
  // An application context, not an HTTP server: only the providers are wanted.
  const app = await NestFactory.createApplicationContext(
    AppModule.forEnv(env),
    { logger: ['error', 'warn'] }
  );

  try {
    return await run(app.get(ModerationService), command);
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
