#!/usr/bin/env node
/**
 * Generates the documentation screenshots (and the two animated ones) by
 * driving a real editor through
 * `window.__logigator` (the automation API) plus Playwright for the parts that
 * are pure chrome — menus, dialogs and drag gestures the API does not model.
 *
 *   node tools/docs-screenshots/capture.mjs <out-dir> [options]
 *
 * `--help` lists the options. The editor it points at must have `automationApi`
 * on and the debug decorations (`debugMenu`, `showGridBorders`) off — see the
 * README.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { Listr, PRESET_TIMER } from 'listr2';
import { DEFAULT_BASE_URL, launchOptions } from './config.mjs';
import { Editor } from './lib/editor.mjs';
import { writeGif } from './lib/gif.mjs';
import { writePng } from './lib/png.mjs';
import { SHOTS } from './shots/index.mjs';

const require = createRequire(import.meta.url);

async function main(args) {
  const shots =
    args.only.length > 0
      ? args.only.map((name) => {
          const shot = SHOTS.find((s) => s.name === name);
          if (!shot) throw new Error(`unknown shot "${name}"`);
          return shot;
        })
      : SHOTS;

  const { chromium } = require('playwright');
  await fs.mkdir(args.out, { recursive: true });
  const browser = await chromium.launch({
    ...launchOptions(),
    headless: !args.headed
  });

  // One task per shot, run in sequence: they share the browser, and shots
  // racing each other for the CPU would show up in the captures. `exitOnError`
  // off keeps a broken shot from cancelling the rest of the run.
  const runner = new Listr(
    shots.map((shot, index) => ({
      title: `${index + 1}/${shots.length}  ${shot.name}`,
      task: (_ctx, task) => capture(shot, task, browser, args)
    })),
    {
      concurrent: false,
      exitOnError: false,
      rendererOptions: { timer: PRESET_TIMER }
    }
  );

  try {
    await runner.run();
  } finally {
    await browser.close();
  }

  const failed = runner.tasks.filter((task) => task.hasFailed()).length;
  console.log(`\n${shots.length - failed}/${shots.length} → ${args.out}`);
  if (failed > 0) process.exitCode = 1;
}

/**
 * Stages one shot and writes what it returns. The editor reports the step it is
 * on as `task.output`, so a shot that sits for seconds says which part of
 * itself it is waiting on.
 */
async function capture(shot, task, browser, args) {
  const editor = new Editor(browser, {
    baseUrl: args.base,
    onProgress: (step) => (task.output = step)
  });
  try {
    await editor.open(shot.context ?? {});
    const result = await shot.run(editor);
    if (result.frames) {
      // An animated shot returns the frames it captured along the way.
      task.output = 'encoding the gif';
      await writeGif(
        path.join(args.out, `${shot.name}.gif`),
        result.frames,
        result.delay
      );
      // Both, because a piped log has already printed the title by now and
      // only the output line still reaches it.
      const frames = `${result.frames.length} frames`;
      task.output = frames;
      task.title += `  ${frames}`;
    } else {
      task.output = 'capturing';
      const png = await editor.snap(result);
      task.output = 'encoding the png';
      await writePng(path.join(args.out, `${shot.name}.png`), png);
    }
  } finally {
    await editor.close();
  }
}

// The task list hides the cursor while it renders, and an interrupt skips the
// cleanup that would bring it back. Playwright installs its own SIGINT handler
// to close the browser and exit, so this one only restores the terminal.
process.on('SIGINT', () => process.stdout.write('\u001B[?25h'));

const program = new Command()
  .name('capture.mjs')
  .description('Generates the documentation screenshots by driving the editor')
  .argument('<out-dir>', 'directory the images are written to', (value) =>
    path.resolve(value)
  )
  .option(
    '--only <shots>',
    'capture just these shots (comma separated)',
    (value) => value.split(',').filter(Boolean),
    []
  )
  .option('--base <url>', 'editor to drive', DEFAULT_BASE_URL)
  .option('--headed', 'run the browser headed')
  .action(async (out, options) => {
    await main({ out, ...options });
  });

try {
  // Commander reports usage errors itself and exits; this catches the run.
  await program.parseAsync();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
