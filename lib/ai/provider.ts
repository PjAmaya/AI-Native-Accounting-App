import type { ToolDefinition } from "./tools";

export type ToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; providerData?: unknown }
  | { role: "tool"; name: string; result: unknown };

export type ChatResult = {
  text: string;
  toolCalls: ToolCall[];
  providerData?: unknown;
};

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
};

export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  chat(request: ChatRequest): Promise<ChatResult>;
}
