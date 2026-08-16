declare module 'aes-js' {
  export namespace utils {
    namespace hex {
      function fromBytes(bytes: Uint8Array): string;
      function toBytes(hex: string): Uint8Array;
    }
    namespace utf8 {
      function fromBytes(bytes: Uint8Array): string;
      function toBytes(text: string): Uint8Array;
    }
  }

  export class Counter {
    constructor(initialValue: number | Uint8Array);
  }

  export namespace ModeOfOperation {
    class ctr {
      constructor(key: Uint8Array, counter?: Counter);
      encrypt(bytes: Uint8Array): Uint8Array;
      decrypt(bytes: Uint8Array): Uint8Array;
    }
  }
}
