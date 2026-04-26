import type { SpankApi } from "../../preload";

declare global {
  interface Window {
    spank: SpankApi;
  }
}

export {};
