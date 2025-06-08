declare module 'file-type' {
  export interface FileTypeResult {
    ext: string;
    mime: string;
  }

  export function fromBuffer(buffer: Buffer): Promise<FileTypeResult | undefined>;
  export function fromFile(path: string): Promise<FileTypeResult | undefined>;
  export function fromStream(stream: NodeJS.ReadableStream): Promise<FileTypeResult | undefined>;
}