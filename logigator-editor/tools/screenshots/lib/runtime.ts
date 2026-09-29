import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

/**
 * Loading the repo's own TypeScript from Node, which is how this tool reads the
 * contracts it has to agree with: core's origin codec and the API's response
 * schemas. A capture that renders in a language, or a mock that answers in a
 * shape, the app does not read fails silently and plausibly — so the source is
 * loaded rather than restated.
 *
 * That source is written for the bundler, not for Node, and the hooks here are
 * what close the gap instead of every call site working around it: they
 * resolve the imports the bundler would, and compile what Node's type
 * stripping refuses.
 *
 * Importing this module is what installs them, so everything that loads repo
 * source imports it first and then reaches that source through a dynamic
 * `import()` — a static one is resolved before any module body runs, hooks
 * included, and a literal specifier is what lets the type checker follow it.
 *
 * A module Node does load itself outside a package declaring `"type":
 * "module"` is reported as typeless — a warning that would print into the
 * middle of the task list, so that one is dropped.
 */
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (
    (warning as NodeJS.ErrnoException).code !== 'MODULE_TYPELESS_PACKAGE_JSON'
  )
    console.warn(warning);
});

const REPO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);

/** A workspace member's `src/`, as an absolute path. */
function member(member: string, ...rest: string[]): string {
  return path.join(REPO, member, 'src', ...rest);
}

const CORE_SRC = member('logigator-core');
const CONTRACT_SRC = member('logigator-contract');

/** The tool's own modules, which Node strips as they are. */
const TOOL_URL = new URL('..', import.meta.url).href;

/**
 * Resolution: the repo's TypeScript imports the shared packages by their
 * tsconfig alias, and it leaves extensions off relative imports. Both are
 * resolved here, so a contract file loads exactly as the apps compile it.
 *
 * The `file:` fallback is what covers the missing extensions — `@logigator/core`
 * resolves through the root `node_modules`, so it needs the alias above, while
 * a sibling `./page.contract` needs the `.ts` appended.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === '@logigator/core' ||
      specifier === '@logigator/contract'
    ) {
      const src = specifier.endsWith('core') ? CORE_SRC : CONTRACT_SRC;
      return {
        url: pathToFileURL(path.join(src, 'public-api.ts')).href,
        shortCircuit: true
      };
    }
    if (specifier.startsWith('@logigator/core/')) {
      const rest = specifier.slice('@logigator/core/'.length);
      return {
        url: pathToFileURL(member('logigator-core', `${rest}.ts`)).href,
        shortCircuit: true
      };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (
        candidate.protocol === 'file:' &&
        fs.existsSync(fileURLToPath(candidate))
      ) {
        return { url: candidate.href, shortCircuit: true };
      }
      throw error;
    }
  },

  /**
   * Compilation: core declares `enum`s and imports types without `type`, both
   * of which the bundler compiles and Node's type stripping refuses — the
   * first as unsupported syntax, the second as an export the module does not
   * have. `transpileModule` is the bundler's per-file compile, so a repo module
   * loads as the apps build it. The tool's own modules stay with Node's
   * stripping, which keeps them to syntax it can erase.
   *
   * The file is read here rather than through `nextLoad`, which already
   * strips it to tell ESM from CommonJS and throws on the first `enum`.
   */
  load(url, context, nextLoad) {
    if (
      !url.startsWith('file:') ||
      !url.endsWith('.ts') ||
      url.startsWith(TOOL_URL)
    ) {
      return nextLoad(url, context);
    }
    const file = fileURLToPath(url);
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
      }
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
});
