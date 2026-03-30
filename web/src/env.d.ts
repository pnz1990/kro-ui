// Ambient module declarations for non-TypeScript file imports.
// Required by TypeScript 6.0+ which enforces TS2882 for side-effect imports
// of files without type declarations (e.g. `import './Foo.css'`).
// Vite handles the actual CSS loading at build/runtime.

declare module '*.css' {
  const content: Record<string, string>
  export default content
}
