// @ts-check
// Rspack bundles the API together with the source of `@logigator/core` and
// `@logigator/contract`, which is what lets every consumer in the workspace —
// the editor included — compile those packages from source instead of from a
// built `dist/`. Follows Rspack's NestJS guide.
import { fileURLToPath } from 'node:url';
import nodeExternals from 'webpack-node-externals';

const here = fileURLToPath(new URL('.', import.meta.url));

export default {
  target: 'node',
  entry: { main: './src/main.ts' },
  output: {
    // Alongside the frontend bundles: every artifact in the workspace lands in
    // the root dist/ under its project name.
    path: fileURLToPath(new URL('../dist/logigator-api', import.meta.url)),
    filename: '[name].js',
    // No `clean`: it deletes and recreates main.js on every rebuild, which loses
    // a file-level watch on the output (the dev loop watches the directory).
    clean: false
  },
  resolve: {
    extensions: ['.ts', '.js'],
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
      // would be treated as ordinary dependencies and left as a runtime
      // `require` of a package that has no entry point. They are compiled from
      // source and must be bundled.
      allowlist: [/^@logigator\//]
    })
  ],
  externalsPresets: { node: true },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
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
  // A long-running server gains nothing from minification, and Nest reflects on
  // class and function names — mangling them breaks dependency injection.
  optimization: { minimize: false },
  devtool: 'source-map',
  stats: 'errors-warnings'
};
