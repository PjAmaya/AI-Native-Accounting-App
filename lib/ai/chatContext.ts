import { AsyncLocalStorage } from "node:async_hooks";

export type ChatRequestContext = {
  pdfBytes?: Buffer;
};

// Per-request state for a chat turn, so a PDF uploaded in one request can never
// be attached to a bill created by another.
export const chatContext = new AsyncLocalStorage<ChatRequestContext>();
