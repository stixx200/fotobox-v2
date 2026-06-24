declare module 'node-ssdp' {
  export interface SsdpHeaders {
    LOCATION?: string;
    [key: string]: any;
  }

  export class Client {
    constructor();
    search(serviceType: string): void;
    start(): void;
    stop(): void;
    on(event: string, handler: (headers: SsdpHeaders) => void): void;
    removeListener(event: string, handler: (headers: SsdpHeaders) => void): void;
  }
}
