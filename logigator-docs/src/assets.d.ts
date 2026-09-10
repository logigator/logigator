/**
 * Screenshot imports. Both apps load a picture through their own build's
 * `loader` map, which emits it as a file and hands the import its hashed URL —
 * so the images, unlike the markdown, are declared once here and shared. This
 * declaration is for the member's own `tsc` and lint programs; inside an app
 * the app's own `src/assets.d.ts` is what the resolution falls back to.
 */

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.gif' {
  const url: string;
  export default url;
}
