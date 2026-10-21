declare module 'browser-id3-writer' {
  export default class ID3Writer {
    constructor(buffer: ArrayBuffer);
    setFrame(frameName: string, value: any): this;
    addTag(): void;
    get arrayBuffer(): ArrayBuffer;
  }
}

declare module '@breezystack/lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): ArrayBuffer | Int8Array | Uint8Array;
    flush(): ArrayBuffer | Int8Array | Uint8Array;
  }
}
