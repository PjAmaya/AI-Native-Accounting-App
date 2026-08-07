import type { ChatProvider, ChatRequest, ChatResult, ToolCall } from "./provider";

const DEFAULT_MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function toContents(messages: ChatRequest["messages"]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.text }] });
      continue;
    }

    if (message.role === "assistant") {
      if (message.providerData) {
        contents.push(message.providerData as GeminiContent);
        continue;
      }
      const parts: GeminiPart[] = [];
      if (message.text) parts.push({ text: message.text });
      for (const call of message.toolCalls) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
      continue;
    }

    contents.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: message.name,
            response: { result: message.result },
          },
        },
      ],
    });
  }

  return contents;
}

export function createGeminiProvider(): ChatProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  return {
    name: "gemini",
    model,

    async chat(request: ChatRequest): Promise<ChatResult> {
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set. Add it to .env and restart the server.");
      }

      const body = {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: toContents(request.messages),
        tools:
          request.tools.length > 0
            ? [
                {
                  functionDeclarations: request.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  })),
                },
              ]
            : undefined,
        generationConfig: { temperature: 0 },
      };

      const RETRYABLE = new Set([429, 500, 502, 503, 504]);
      const MAX_ATTEMPTS = 4;
      let response: Response | null = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        response = await fetch(`${BASE}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        });

        if (response.ok || !RETRYABLE.has(response.status)) break;
        if (attempt === MAX_ATTEMPTS - 1) break;

        const backoff = 500 * 2 ** attempt + Math.floor(Math.random() * 400);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }

      if (!response || !response.ok) {
        const detail = response ? await response.text() : "no response";
        const status = response?.status ?? 0;
        const hint =
          status === 429
            ? " You have hit the free-tier rate limit. Wait a minute and try again."
            : status === 503
              ? " The model is busy. This usually clears in a few seconds."
              : "";
        throw new Error(`Gemini returned ${status}.${hint} ${detail.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        candidates?: { content?: GeminiContent }[];
      };

      const content = data.candidates?.[0]?.content;
      const parts = content?.parts ?? [];

      const text = parts
        .map((p) => p.text ?? "")
        .filter(Boolean)
        .join("\n");

      const toolCalls: ToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p) => ({
          name: p.functionCall!.name,
          args: p.functionCall!.args ?? {},
        }));

      return { text, toolCalls, providerData: content };
    },
  };
}
