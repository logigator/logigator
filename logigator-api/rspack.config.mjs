// @ts-check
// Rspack bundles the API together with the source of `@logigator/core` and
// `@logigator/contract`, which is what lets every consumer in the workspace —
// the editor included — compile those packages from source instead of from a
// built `dist/`. Follows Rspack's NestJS guide, and the ESM settings below
// mirror what the NestJS 12 CLI's own Rspack builder emits for a package
// declaring `"type": "module"`.
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import nodeExternals from 'webpack-node-externals';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  target: 'node',
  // ESM output. Every `@nestjs/*` package ships as ESM, the source is
  // ESM-authored, and this is what NestJS 12 scaffolds — so the bundle stops
  // being the one CommonJS link in the chain.
  experiments: { outputModule: true, topLevelAwait: true },
  // Three entry points: the server, the migration runner a release runs before
  // it (`node migrate.js`), and the document re-normalizer a format bump deploys
  // with (`node renormalize.js`). Bundling them keeps deploys free of drizzle-kit
  // and of any TypeScript loader.
  entry: {
    main: './src/main.ts',
    migrate: './src/database/migrate.main.ts',
    renormalize: './src/database/renormalize.main.ts'
  },
  output: {
    // Alongside the frontend bundles: every artifact in the workspace lands in
    // the root dist/ under its project name.
    path: fileURLToPath(new URL('../dist/logigator-api', import.meta.url)),
    filename: '[name].js',
    module: true,
    chunkFormat: 'module',
    chunkLoading: 'import',
    library: { type: 'module' },
    // No `clean`: it deletes and recreates main.js on every rebuild, which loses
    // a file-level watch on the output (the dev loop watches the directory).
    clean: false
  },
  resolve: {
    extensions: ['.ts', '.js'],
    // A relative import may name the `.js` file it will become, the way Node's
    // ESM resolver demands and the NestJS scaffold writes; the source here does
    // not, and both resolve to the same module.
    extensionAlias: { '.js': ['.ts', '.js'] },
    // The `paths` mapping in tsconfig.json is the single source of truth for
    // the workspace aliases, so the bundler and the type checker cannot drift —
    // and the mapping there deliberately covers core and the contract only.
    tsConfig: { configFile: `${here}tsconfig.json` }
  },
  externals: [
    nodeExternals({
      // Resolve the module list from the workspace root: with Yarn's
      // node-modules linker there is no logigator-api/node_modules.
      modulesDir: fileURLToPath(new URL('../node_modules', import.meta.url)),
      // Yarn symlinks workspace members into node_modules, so without this they
      // would be treated as ordinary dependencies and left as a runtime import
      // of a package that has no entry point. They are compiled from source and
      // must be bundled.
      allowlist: [/^@logigator\//],
      // Matches the output format, so a dependency is `import`ed rather than
      // `require`d — which is what lets the ESM-only `@nestjs/*` packages load
      // as themselves instead of through Node's `require(esm)` bridge.
      importType: 'module'
    }),
    externalBuiltins
  ],
  // Off, because the preset's blanket treatment is CommonJS-shaped; Node's own
  // modules are named as ESM externals below instead.
  externalsPresets: { node: false },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        type: 'javascript/esm',
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', decorators: true },
            // Nest resolves constructor dependencies from `design:paramtypes`,
            // so the legacy decorator transform and its metadata are required;
            // tsconfig keeps `experimentalDecorators`/`emitDecoratorMetadata` in
            // step for the type checker.
            transform: { legacyDecorator: true, decoratorMetadata: true },
            target: 'es2022'
          }
        }
      }
    ]
  },
  plugins: [emitModuleTypeMarker],
  // A long-running server gains nothing from minification, and Nest reflects on
  // class and function names — mangling them breaks dependency injection.
  optimization: { minimize: false },
  devtool: 'source-map',
  stats: 'errors-warnings'
};

/**
 * Leaves Node's own modules to Node. They do not live in `node_modules`, so the
 * externals check above never sees them, and the `node` preset that would
 * otherwise cover them is off.
 */
function externalBuiltins({ request }, callback) {
  if (!request) return callback();

  const bare = request.startsWith('node:') ? request.slice(5) : request;
  return builtinModules.includes(bare)
    ? callback(null, `module ${request}`)
    : callback();
}

/**
 * Declares the output directory ESM, which is what makes Node read these `.js`
 * files as modules — the same `"type": "module"` marker the NestJS scaffold puts
 * on a package, written into the bundle's own directory because the artifact
 * lands in the workspace's root `dist/` and would otherwise inherit the root
 * manifest, which has no type.
 *
 * It ships with the bundle the way `drizzle/` does. Without it every entry dies
 * on its first `import`.
 */
const MODULE_TYPE_MARKER = 'package.json';

function emitModuleTypeMarker(compiler) {
  const { Compilation, sources } = compiler.rspack;

  compiler.hooks.thisCompilation.tap(
    'emit-module-type-marker',
    (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'emit-module-type-marker',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
        },
        () => {
          compilation.emitAsset(
            MODULE_TYPE_MARKER,
            new sources.RawSource('{ "type": "module" }\n')
          );
        }
      );
    }
  );
}
