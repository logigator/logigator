// @ts-check
// Bundles the API together with the source of `@logigator/core` and
// `@logigator/contract`, so those packages are compiled from source rather than
// from a built `dist/`. The ESM settings mirror the NestJS 12 CLI's own Rspack
// builder for a package declaring `"type": "module"`.
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import nodeExternals from 'webpack-node-externals';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  target: 'node',
  // ESM output: every `@nestjs/*` package ships as ESM, and the source is
  // ESM-authored.
  experiments: { outputModule: true, topLevelAwait: true },
  // The server, the migration runner and the document re-normalizer. Bundling
  // all three keeps deploys free of drizzle-kit and of any TypeScript loader.
  entry: {
    main: './src/main.ts',
    migrate: './src/database/migrate.main.ts',
    renormalize: './src/database/renormalize.main.ts'
  },
  output: {
    // Every artifact in the workspace lands in the root dist/ under its name.
    path: fileURLToPath(new URL('../dist/logigator-api', import.meta.url)),
    filename: '[name].js',
    module: true,
    chunkFormat: 'module',
    chunkLoading: 'import',
    library: { type: 'module' },
    // Cleaning deletes and recreates main.js on every rebuild, which loses a
    // file-level watch on the output.
    clean: false
  },
  resolve: {
    extensions: ['.ts', '.js'],
    // A relative import may name the `.js` file it will become, the way Node's
    // ESM resolver demands; the source here does not, and both resolve alike.
    extensionAlias: { '.js': ['.ts', '.js'] },
    // tsconfig.json's `paths` is the single source of truth for the workspace
    // aliases, so the bundler and the type checker cannot drift.
    tsConfig: { configFile: `${here}tsconfig.json` }
  },
  externals: [
    nodeExternals({
      // With Yarn's node-modules linker there is no logigator-api/node_modules.
      modulesDir: fileURLToPath(new URL('../node_modules', import.meta.url)),
      // Yarn symlinks workspace members into node_modules, so without this they
      // are left as a runtime import of a package that has no entry point.
      allowlist: [/^@logigator\//],
      // Matches the output format, so the ESM-only `@nestjs/*` packages are
      // `import`ed rather than loaded through Node's `require(esm)` bridge.
      importType: 'module'
    }),
    externalBuiltins
  ],
  // The preset's blanket treatment is CommonJS-shaped; Node's own modules are
  // named as ESM externals below instead.
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
            // so both are required; tsconfig keeps `experimentalDecorators`
            // and `emitDecoratorMetadata` in step for the type checker.
            transform: { legacyDecorator: true, decoratorMetadata: true },
            target: 'es2022'
          }
        }
      }
    ]
  },
  plugins: [emitModuleTypeMarker],
  // Nest reflects on class and function names, so mangling breaks DI, and a
  // long-running server gains nothing from minification anyway.
  optimization: { minimize: false },
  devtool: 'source-map',
  stats: 'errors-warnings'
};

/**
 * Leaves Node's own modules to Node. They do not live in `node_modules`, so the
 * externals check above never sees them, and the `node` preset is off.
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
 * files as modules. It goes in the bundle's own directory because the artifact
 * lands in the workspace's root `dist/`, whose manifest declares no type;
 * without it every entry dies on its first `import`.
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
