import { createGeminiProvider } from "./gemini";
import { ALL_TOOLS, checkAccountCodes } from "./tools";
import { WRITE_TOOLS } from "./writeTools";

const TOOLS = [...ALL_TOOLS, ...WRITE_TOOLS];
const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.filter((t) => t.name.startsWith("create_")).map((t) => t.name));
import type { ChatMessage, ChatProvider, ToolCall } from "./provider";

const MAX_ROUNDS = 5;

export type ChatStep = {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  write: boolean;
  link?: string;
};

export type ChatAnswer = {
  answer: string;
  steps: ChatStep[];
  model: string;
  warnings: string[];
};

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);

  return [
    "You are an experienced Canadian accountant advising the owner of Story Craft Studio, a small consulting business in Ontario. He has a strong finance background but no CPA and no external accountant, so be direct and technical rather than simplified.",
    `Today is ${today}. The fiscal year is the calendar year. Amounts are Canadian dollars.`,
    "",
    "You answer two kinds of question, and they have different rules.",
    "",
    "A. QUESTIONS ABOUT THE NUMBERS — what the books say.",
    "1. Never calculate, estimate, or recall a figure yourself. Every number must come from a tool result in this conversation. If no tool gives it to you, say so plainly.",
    "2. Quote figures exactly as returned. Do not round, restate, or convert.",
    "3. If a tool reports that something does not tie or balance, lead with that. It matters more than the total.",
    "3a. ALWAYS state the period or as-of date before the figures, as its own opening sentence. For example: 'For January 1 to August 6, 2026:' — a number without its period is not an answer.",
    "3b. If the question names a period you cannot pin down — 'last quarter', 'this year so far', 'since we started' — ASK which dates before calling anything. If no period is mentioned at all, use the fiscal year to date and say so.",
    "3c. If a report comes back empty or all zeros, do not speculate about why. Say what the period was and suggest the dates may not cover the activity.",
    "",
    "B. QUESTIONS ABOUT TREATMENT — how something should be recorded.",
    "4. Call get_business_context and list_accounts BEFORE answering. Advice that ignores the legal structure, HST status, capitalization threshold, or the actual chart of accounts is worse than no advice.",
    "5. Name the specific accounts that exist. If none fits, say what account should be created and where it belongs.",
    "6. Explain the reasoning from principles: capital versus expense, the threshold, useful life, accrual timing, which side of the operating line something sits on.",
    "6a. Quote account codes and names EXACTLY as list_accounts returned them. Never reformat, abbreviate, or reorder the digits. If you propose a NEW account, say clearly that it does not exist yet.",
    "7. NEVER state a CCA class number, a depreciation rate, a tax bracket, a filing deadline, a dollar threshold, or a rule reference as fact. You cannot verify these and they change. Say which lookup is needed and where — 'this is a CCA class question; check CRA's T4002 guide or the CCA classes page' — then stop. Guessing a class number is worse than declining.",
    "8. Distinguish clearly between BOOK treatment (what this system records) and TAX treatment (what goes on the return). They differ, especially for depreciation.",
    "",
    "ALWAYS:",
    "9. Be brief. Lead with the answer. Two or three sentences unless asked for more.",
    "",
    "C. CREATING THINGS.",
    "10. You can create DRAFT invoices, DRAFT bills, and contacts. Everything you create is a draft: it posts nothing, changes no balance, and appears in no report until the user issues or approves it themselves.",
    "11. Before creating, make sure you have the right client or vendor and the right amounts. If a name is ambiguous or an account code is uncertain, call list_contacts, list_projects or list_accounts first. If it is still unclear, ASK rather than guess.",
    "12. After creating, say exactly what was made, the total, and that it is a draft awaiting their action. Always include the link the tool returned.",
    "13. You CANNOT issue, approve, post, void, pay, or delete anything. Those are the user's actions. If asked, say which screen does it.",
    "14. Never create the same thing twice. If you are unsure whether something already exists, list first.",
    "11. Where a decision has real money or compliance consequence, say what a CPA should confirm. Do not hedge everything — only where it is genuinely uncertain.",
  ].join("\n");
}

async function runTool(call: ToolCall): Promise<{ result: unknown; ok: boolean }> {
  const tool = TOOLS_BY_NAME.get(call.name);
  if (!tool) {
    return { result: { error: `No tool named ${call.name}.` }, ok: false };
  }
  try {
    return { result: await tool.handler(call.args), ok: true };
  } catch (e) {
    return { result: { error: (e as Error).message }, ok: false };
  }
}

export async function runChat(
  question: string,
  history: ChatMessage[] = [],
  provider: ChatProvider = createGeminiProvider(),
): Promise<ChatAnswer> {
  const messages: ChatMessage[] = [...history, { role: "user", text: question }];
  const steps: ChatStep[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await provider.chat({
      system: systemPrompt(),
      messages,
      tools: TOOLS,
    });

    if (result.toolCalls.length === 0) {
      const answer = result.text.trim() || "I could not produce an answer.";
      const issues = await checkAccountCodes(answer);
      return {
        answer,
        steps,
        model: provider.model,
        warnings: issues.map((i) =>
          i.actualName === null
            ? `Account ${i.code} does not exist in your chart of accounts.`
            : `Account ${i.code} is "${i.actualName}", not "${i.statedName}".`,
        ),
      };
    }

    messages.push({
      role: "assistant",
      text: result.text,
      toolCalls: result.toolCalls,
      providerData: result.providerData,
    });

    for (const call of result.toolCalls) {
      const { result: value, ok } = await runTool(call);
      const link =
        ok && value && typeof value === "object" && "link" in value
          ? String((value as { link: unknown }).link)
          : undefined;
      steps.push({ tool: call.name, args: call.args, ok, write: WRITE_TOOL_NAMES.has(call.name), link });
      messages.push({ role: "tool", name: call.name, result: value });
    }
  }

  return {
    answer:
      "I looked at several reports but could not settle on an answer. Try asking about one thing at a time.",
    steps,
    model: provider.model,
    warnings: [],
  };
}
