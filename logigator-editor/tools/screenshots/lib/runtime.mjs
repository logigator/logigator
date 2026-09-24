import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Loading the repo's own TypeScript from Node, which is how this tool reads the
 * contracts it has to agree with: core's origin codec and the API's response
 * schemas. A capture that renders in a language, or a mock that answers in a
 * shape, the app does not read fails silently and plausibly — so the source is
 * loaded rather than restated.
 *
 * Node strips the types as it loads, which is enough for all of it: nothing
 * these modules do at definition time needs a compiler. Two things are not, and
 * are resolved here instead of being worked around at every call site.
 *
 * They sit outside any package declaring `"type": "module"`, which Node reports
 * as a typeless module — a warning that would print into the middle of the task
 * list, so that one is dropped. Importing this module is what installs the
 * filter, so everything that loads repo source imports it rather than
 * repeating the dance.
 */
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

const REPO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);

/** A workspace member's `src/`, as an absolute path. */
function member(member, ...rest) {
  return path.join(REPO, member, 'src', ...rest);
}

const CORE_SRC = member('logigator-core');
const CONTRACT_SRC = member('logigator-contract');

/**
 * The repo's TypeScript is written for the bundler, not for Node: it imports
 * the shared packages by their tsconfig alias, and it leaves extensions off
 * relative imports. Both are resolved here, so a contract file loads exactly as
 * the apps compile it.
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
  }
});

/** Imports a module by absolute path. */
export function load(file) {
  return import(pathToFileURL(file).href);
}

/** One of core's `src/origin/` modules. */
export function loadOrigin(name) {
  return load(member('logigator-core', 'origin', `${name}.ts`));
}

/** One of the contract's `src/` modules. */
export function loadContract(relativePath) {
  return load(member('logigator-contract', `${relativePath}.ts`));
}
