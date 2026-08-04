#!/usr/bin/env node
/**
 * Generates the documentation screenshots (and the two animated ones) by
 * driving a real editor through
 * `window.__logigator` (the automation API) plus Playwright for the parts that
 * are pure chrome — menus, dialogs and drag gestures the API does not model.
 *
 *   node tools/docs-screenshots/capture.mjs <out-dir> [options]
 *
 * Each language lands in its own sub-directory of <out-dir>, mirroring
 * `src/assets/docs/<lang>/images/`.
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
import { DEFAULT_BASE_URL, LOCALES, launchOptions } from './config.mjs';
import { Editor } from './lib/editor.mjs';
import { encodeGif } from './lib/gif.mjs';
import { encodePng } from './lib/png.mjs';
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
  // In the shipped order, so English — the language the rest are compared
  // against — always runs first.
  const langs = LOCALES.filter((lang) => args.lang.includes(lang));
  for (const lang of args.lang) {
    if (!langs.includes(lang)) throw new Error(`unknown language "${lang}"`);
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    ...launchOptions(),
    headless: !args.headed
  });

  // English's bytes, keyed by file name: a localized capture that matches one
  // is not written, and the documentation falls back to the English picture.
  // The encoders are deterministic, so this compares pictures, not runs.
  const english = new Map();

  // One task per shot within one per language, run in sequence: they share the
  // browser, and shots racing each other for the CPU would show up in the
  // captures. `exitOnError` off keeps a broken shot from cancelling the rest.
  const runner = new Listr(
    langs.map((lang) => ({
      title: lang,
      task: (_ctx, group) =>
        group.newListr(
          shots.map((shot, index) => ({
            title: `${index + 1}/${shots.length}  ${shot.name}`,
            task: (_c, task) =>
              capture(shot, task, browser, {
                ...args,
                lang,
                out: path.join(args.out, lang),
                english: langs.includes('en') ? english : null
              })
          })),
          { concurrent: false, exitOnError: false }
        )
    })),
    {
      concurrent: false,
      exitOnError: false,
      rendererOptions: { timer: PRESET_TIMER, collapseSubtasks: false }
    }
  );

  try {
    await runner.run();
  } finally {
    await browser.close();
  }

  const groups = runner.tasks.flatMap((task) => task.subtasks);
  const failed = groups.filter((task) => task.hasFailed()).length;
  const total = langs.length * shots.length;
  console.log(`\n${total - failed}/${total} → ${args.out}`);
  if (!langs.includes('en') && langs.length > 0) {
    console.log(
      'every capture written: without an English pass there is nothing to ' +
        'compare them against'
    );
  }
  if (failed > 0) process.exitCode = 1;
}

/**
 * Stages one shot in one language and writes what it returns. The editor
 * reports the step it is on as `task.output`, so a shot that sits for seconds
 * says which part of itself it is waiting on.
 */
async function capture(shot, task, browser, args) {
  const editor = new Editor(browser, {
    baseUrl: args.base,
    lang: args.lang,
    onProgress: (step) => (task.output = step)
  });
  try {
    await editor.open(shot.context ?? {});
    const result = await shot.run(editor);
    let file;
    let bytes;
    if (result.frames) {
      // An animated shot returns the frames it captured along the way.
      task.output = 'encoding the gif';
      file = `${shot.name}.gif`;
      bytes = await encodeGif(result.frames, result.delay);
      // Both, because a piped log has already printed the title by now and
      // only the output line still reaches it.
      const frames = `${result.frames.length} frames`;
      task.output = frames;
      task.title += `  ${frames}`;
    } else {
      task.output = 'capturing';
      const png = await editor.snap(result);
      task.output = 'encoding the png';
      file = `${shot.name}.png`;
      bytes = await encodePng(png);
    }
    await write(file, bytes, task, args);
  } finally {
    await editor.close();
  }
}

/**
 * Writes one capture — unless an earlier language already produced the same
 * picture. A shot of the board carries no interface text, so every language
 * captures it identically; leaving those unwritten is what keeps the
 * documentation down to one copy of each, the other languages falling back to
 * the English one.
 */
async function write(file, bytes, task, args) {
  const english = args.english;
  if (args.lang === 'en') english?.set(file, bytes);
  else if (english?.get(file)?.equals(bytes)) {
    task.title += '  = en';
    task.output = 'identical to the English capture — not written';
    return;
  }
  await fs.mkdir(args.out, { recursive: true });
  await fs.writeFile(path.join(args.out, file), bytes);
}

// The task list hides the cursor while it renders, and an interrupt skips the
// cleanup that would bring it back. Playwright installs its own SIGINT handler
// to close the browser and exit, so this one only restores the terminal.
process.on('SIGINT', () => process.stdout.write('\u001B[?25h'));

const program = new Command()
  .name('capture.mjs')
  .description('Generates the documentation screenshots by driving the editor')
  .argument(
    '<out-dir>',
    'directory the per-language image folders are written to',
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
    'languages to capture, one sub-directory each (comma separated)',
    (value) => value.split(',').filter(Boolean),
    LOCALES
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
