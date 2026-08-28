/**
 * Minimal declaration for the two Node stream classes the share test polyfills with.
 * The project deliberately does not depend on @types/node, and shipped code never
 * imports this module: it is here so the test can borrow Node's implementation.
 */
declare module "node:stream/web" {
  interface ByteTransform {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
  }
  export const CompressionStream: { new (format: string): ByteTransform };
  export const DecompressionStream: { new (format: string): ByteTransform };
}
