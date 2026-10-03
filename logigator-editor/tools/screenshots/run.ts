#!/usr/bin/env node
/**
 * Generates a target's images by driving the editor through `window.__logigator`
 * (the automation API), plus Playwright for the chrome the API does not model —
 * menus, dialogs, drag gestures.
 *
 *   node tools/screenshots/run.ts <target> <out-dir> [options]
 *
 * Every target is one folder under `targets/`: it owns its shot list, the
 * colour schemes to run, where a capture lands and what it is called. This file
 * walks that matrix, frames each shot, encodes what it returned and writes it —
 * it names no shot, no file name and no format of its own.
 *
 * The editor must have the automation API on and the debug decorations off —
 * see the README.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { Listr, PRESET_TIMER, type ListrTask } from 'listr2';
import { chromium, type Browser } from 'playwright';
import { launchOptions } from './lib/config.ts';
import { Editor } from './lib/editor.ts';
import type { Pass, Shot, Target } from './lib/target.ts';
import { encodeCapture } from './lib/webp.ts';

const TARGETS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'targets'
);

/** What the command line asks for, with its unset options defaulted. */
interface RunOptions {
  target: LoadedTarget;
  out: string;
  only: string[];
  lang: readonly string[];
  theme: readonly string[];
  base?: string;
  baseline: boolean;
  headed?: boolean;
}

/** A target as the runner holds it: what it declares, plus its folder's name. */
type LoadedTarget = Target & { name: string };

/** What every shot of one pass shares. */
interface PassContext {
  target: LoadedTarget;
  browser: Browser;
  base: string;
  pass: Pass;
  isBaseline: boolean;
  /** A scheme's baseline captures by shot; `null` under `--no-baseline`. */
  baseline: Map<string, Buffer> | null;
  out: string;
}

/** The handle listr2 gives a running task; a shot writes its title and output. */
type ShotTask = Parameters<ListrTask['task']>[1];

async function main(options: RunOptions): Promise<void> {
  const browser = await chromium.launch({
    ...launchOptions(),
    headless: !options.headed
  });
  try {
    await runTarget({ ...options, browser });
  } finally {
    await browser.close();
  }
}

/**
 * Loads one target by the folder it lives in, which is also the name it is
 * known by everywhere else — so there is no second copy of it to drift.
 *
 * Both refusals happen here so a mistyped target or a half-written one is
 * answered before the browser opens.
 */
async function loadTarget(name: string): Promise<LoadedTarget> {
  const file = path.join(TARGETS_DIR, name, 'INDEX.ts');
  if (!(await exists(file))) {
    const entries = await fs.readdir(TARGETS_DIR, { withFileTypes: true });
    const known = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .join(', ');
    throw new Error(
      `unknown target "${name}" — ${known}, or add targets/${name}/`
    );
  }
  const module = (await import(file)) as { default: Target };
  const target = { ...module.default, name };
  requireTargetShape(target);
  return target;
}

async function runTarget(
  options: RunOptions & { browser: Browser }
): Promise<void> {
  const { target, browser } = options;

  // A target with nothing to shoot is a mistake, not a no-op run.
  if (target.shots.length === 0) {
    throw new Error(
      `target "${target.name}" has no shots yet — its media arrives with the ` +
        'page that shows it'
    );
  }

  const shots = selectShots(target, options.only);
  const locales = intersect(target.locales, options.lang, 'language');
  const themes = intersect(target.themes, options.theme, 'colour scheme');
  // Every language of a scheme, in the declared order — English first, so the
  // first pass of each scheme is the one the rest of that scheme falls back to.
  const passes: Pass[] = themes.flatMap((theme) =>
    locales.map((lang) => ({ lang, theme }))
  );
  const base = options.base ?? target.base;
  // A scheme's baseline pass, keyed by the shot it is of. The encoders are
  // deterministic, so equality is a comparison of pictures rather than of runs:
  // a board shot carries no interface text and captures identically in every
  // language, so only one copy of it is written per scheme.
  const baseline = options.baseline ? new Map<string, Buffer>() : null;
  const isBaseline = (pass: Pass) => pass.lang === locales[0];

  const runner = new Listr(
    passes.map((pass) =>
      passTasks(shots, {
        target,
        browser,
        base,
        pass,
        isBaseline: isBaseline(pass),
        baseline,
        out: path.resolve(options.out, target.layout(pass.lang))
      })
    ),
    {
      // Sequential at both levels: the shots share a browser, and racing for
      // the CPU would show up in the captures.
      concurrent: false,
      exitOnError: false,
      rendererOptions: { timer: PRESET_TIMER, collapseSubtasks: false }
    }
  );

  try {
    await runner.run();
  } finally {
    // Reported even when the run was interrupted: what was written is written.
    report(runner.tasks, {
      total: passes.length * shots.length,
      out: options.out,
      baseline: options.baseline
    });
  }

  if (runner.tasks.some((task) => task.subtasks.some((t) => t.hasFailed()))) {
    process.exitCode = 1;
    return;
  }
  if (!target.writeRegistry) return;
  const file = target.writeRegistry(path.resolve(options.out));
  console.log(`registry → ${path.relative(process.cwd(), file)}`);
}

/**
 * What a target has to declare for a run to mean anything. Checked by name so
 * that a target copied from another and missing a field says which field,
 * rather than dying inside whichever helper reached for it first.
 *
 * `shots` is not here: an empty list is refused below with its own message,
 * that being a target written before its page exists rather than a broken one.
 */
const REQUIRED: readonly (keyof Target)[] = [
  'locales',
  'themes',
  'viewport',
  'base',
  'fileName',
  'layout'
];

function requireTargetShape(target: LoadedTarget): void {
  const missing = REQUIRED.filter((field) => target[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `target "${target.name}" declares no ${missing.join(', no ')} — see ` +
        'another target under targets/ for the shape'
    );
  }
}

/** One pass's subtask list: every shot, in the target's own order. */
function passTasks(shots: readonly Shot[], context: PassContext): ListrTask {
  return {
    title: `${context.pass.lang} · ${context.pass.theme}`,
    task: (_ctx, group) =>
      group.newListr(
        shots.map((shot, index) => ({
          title: `${index + 1}/${shots.length}  ${shot.name}`,
          task: (_c, task) => capture(shot, task, context)
        })),
        { concurrent: false, exitOnError: false }
      )
  };
}

/**
 * Stages one shot in one pass and writes what it returned, encoded by the tool.
 * The editor reports its current step as `task.output`, so a stalled shot says
 * what it is waiting on.
 *
 * What the shot declares and what the target stages for it are merged here
 * rather than in the page driver, which is what keeps `Editor` ignorant of both
 * — and `localStorage` merges per key, so a shot overriding one preference
 * keeps the rest of the run's.
 */
async function capture(
  shot: Shot,
  task: ShotTask,
  context: PassContext
): Promise<void> {
  const { target, browser, base, pass } = context;
  const staged = target.before?.(pass) ?? {};
  const editor = new Editor(browser, {
    baseUrl: base,
    lang: pass.lang,
    viewport: target.viewport,
    colorScheme: pass.theme,
    onProgress: (step) => (task.output = step)
  });
  try {
    await editor.open({
      ...shot.context,
      ...staged,
      localStorage: { ...shot.context?.localStorage, ...staged.localStorage }
    });
    const result = await shot.run(editor);

    task.output = 'capturing';
    const frames =
      'frames' in result ? result.frames : [await editor.snap(result)];
    task.output = 'encoding';
    const bytes = await encodeCapture(frames, result.delay);

    const file = target.fileName(shot, pass);
    await write(file, bytes, shot, task, context);
    if (frames.length > 1) {
      // Both: a piped log has already printed the title, and only the output
      // line still reaches it.
      const count = `${frames.length} frames`;
      task.output = count;
      task.title += `  ${count}`;
    }
  } finally {
    await editor.close();
  }
}

/**
 * Writes one capture, unless its scheme's baseline pass already produced the
 * same picture of the same shot. A capture identical to the baseline is not
 * written at all: the consuming page falls back to English, within the scheme
 * the reader is in.
 */
async function write(
  file: string,
  bytes: Buffer,
  shot: Shot,
  task: ShotTask,
  { baseline, pass, isBaseline, out }: PassContext
): Promise<void> {
  const key = `${shot.name}:${pass.theme}`;
  if (isBaseline) baseline?.set(key, bytes);
  else if (baseline?.get(key)?.equals(bytes)) {
    task.title += '  = baseline';
    task.output = 'identical to the baseline capture — not written';
    return;
  }
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, file), bytes);
}

/** A failing shot is reported, not fatal, so the rest of the run still happens. */
function report(
  tasks: Listr['tasks'],
  { total, out, baseline }: { total: number; out: string; baseline: boolean }
): void {
  const groups = tasks.flatMap((task) => task.subtasks ?? []);
  const failed = groups.filter((task) => task.hasFailed()).length;
  console.log(`\n${total - failed}/${total} → ${out}`);
  if (!baseline) {
    console.log(
      'every capture written: without a baseline pass there is nothing to ' +
        'compare them against'
    );
  }
}

/** The shots named by `--only`, in the target's own order. */
function selectShots(
  target: LoadedTarget,
  only: readonly string[]
): readonly Shot[] {
  if (only.length === 0) return target.shots;
  return only.map((name) => {
    const shot = target.shots.find((candidate) => candidate.name === name);
    if (!shot) throw new Error(`target "${target.name}" has no shot "${name}"`);
    return shot;
  });
}

/** The declared values the request asks for, refusing one the target lacks. */
function intersect<T extends string>(
  declared: readonly T[],
  requested: readonly string[],
  what: string
): T[] {
  const selected = declared.filter((value) => requested.includes(value));
  for (const value of requested) {
    if (!(selected as readonly string[]).includes(value)) {
      throw new Error(
        `unknown ${what} "${value}" — try ${declared.join(', ')}`
      );
    }
  }
  return selected;
}

function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false
  );
}

// The task list hides the cursor and an interrupt skips the cleanup that brings
// it back. Playwright's own SIGINT handler closes the browser and exits, so
// this one only restores the terminal.
process.on('SIGINT', () => process.stdout.write('\u001B[?25h'));

const program = new Command()
  .name('run.ts')
  .description("Generates a target's images by driving the editor")
  .argument('<target>', 'target to capture, one folder under targets/')
  .argument(
    '<out-dir>',
    "directory the target's output layout is resolved under",
    (value) => path.resolve(value)
  )
  .option(
    '--only <shots>',
    'capture just these shots (comma separated)',
    (value) => value.split(',').filter(Boolean),
    []
  )
  .option(
    '--lang <codes>',
    'languages to capture, one pass each (comma separated)',
    (value) => value.split(',').filter(Boolean)
  )
  .option(
    '--theme <schemes>',
    'colour schemes to capture (comma separated)',
    (value) => value.split(',').filter(Boolean)
  )
  .option(
    '--base <url>',
    "where the target's editor is served, if not its default"
  )
  .option(
    '--no-baseline',
    'write every pass instead of falling back to the first one'
  )
  .option('--headed', 'run the browser headed')
  .action(async (name: string, out: string, options) => {
    const target = await loadTarget(name);
    await main({
      ...options,
      target,
      out,
      // Unset options mean "whatever the target declares".
      lang: options.lang ?? target.locales,
      theme: options.theme ?? target.themes
    });
  });

try {
  // Commander reports usage errors itself; this catches the run.
  await program.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
