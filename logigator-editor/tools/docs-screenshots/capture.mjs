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
import { DEFAULT_BASE_URL, launchOptions } from './config.mjs';
import { Editor } from './lib/editor.mjs';
import { writeGif } from './lib/gif.mjs';
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

  let failed = 0;
  try {
    for (const shot of shots) {
      const editor = new Editor(browser, { baseUrl: args.base });
      try {
        await editor.open(shot.context ?? {});
        const result = await shot.run(editor);
        if (result.frames) {
          // An animated shot returns the frames it captured along the way.
          const file = path.join(args.out, `${shot.name}.gif`);
          await writeGif(file, result.frames, result.delay);
          console.log(`✓ ${shot.name}.gif (${result.frames.length} frames)`);
        } else {
          const file = path.join(args.out, `${shot.name}.png`);
          await editor.snap(result).then((png) => fs.writeFile(file, png));
          console.log(`✓ ${shot.name}`);
        }
      } catch (error) {
        failed++;
        console.log(`✗ ${shot.name.padEnd(30)} ${error.message}`);
      } finally {
        await editor.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${shots.length - failed}/${shots.length} → ${args.out}`);
  if (failed > 0) process.exitCode = 1;
}

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
