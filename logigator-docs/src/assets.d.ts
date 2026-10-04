/**
 * Screenshot imports. Both apps load a picture through their own build's
 * `loader` map, which emits it as a file and hands the import its hashed URL —
 * so the images, unlike the markdown, are declared once here and shared. This
 * declaration is for the member's own `tsc` and lint programs; inside an app
 * the app's own `src/assets.d.ts` is what the resolution falls back to.
 *
 * WebP is the capture tool's only output format, so it is the only one the
 * screenshots can be.
 */

declare module '*.webp' {
  const url: string;
  export default url;
}
