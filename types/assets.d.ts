/** Metro turns a font import into an asset id. */
declare module '*.ttf' {
  const asset: number;
  export default asset;
}
