/**
 * Asset imports. The build's `loader` map (see `angular.json`) emits each of
 * these as a file and hands the import its URL, so an asset the app renders is
 * content-hashed and can be cached forever — unlike anything copied from
 * `public/`, which keeps the name it was written under.
 */

declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.woff2' {
  const url: string;
  export default url;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.jpg' {
  const url: string;
  export default url;
}

declare module '*.jpeg' {
  const url: string;
  export default url;
}

declare module '*.webp' {
  const url: string;
  export default url;
}

declare module '*.avif' {
  const url: string;
  export default url;
}
