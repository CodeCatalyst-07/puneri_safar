/**
 * @file src/adapters/llm/gemini.ts
 * Google Gemini Generative AI adapter using official @google/genai SDK.
 *
 * REQUIREMENTS:
 * - Read GEMINI_MODEL dynamically from env (never hardcode)
 * - Structured JSON generation validated with Zod
 * - Multi-turn function calling (max 3 rounds, 20s overall timeout)
 * - Typed rate limit handling { ok: false, reason: 'rate_limited' } on 429/quota
 */

import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  LLMProvider,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
} from "./index";

export type LLMResult<T> =
  | { ok: true; data: T; rawText?: string; model?: string }
  | { ok: false; reason: "rate_limited" | "timeout" | "error"; details?: string };

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GeminiFunctionCallOptions {
  prompt: string;
  systemInstruction?: string;
  tools: ToolDeclaration[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  maxRounds?: number;
  timeoutMs?: number;
  model?: string;
}

export type GeminiFunctionCallResult =
  | {
      ok: true;
      text: string;
      toolCallsExecuted: Array<{
        name: string;
        args: Record<string, unknown>;
        result: unknown;
      }>;
      model: string;
    }
  | {
      ok: false;
      reason: "rate_limited" | "timeout" | "error";
      details?: string;
    };

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate limit")
  );
}

export class GeminiLLMProvider implements LLMProvider {
  readonly providerName = "gemini";
  private client: GoogleGenAI | null = null;

  constructor(private apiKeyOverride?: string) {}

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const key = this.apiKeyOverride ?? env.server.GEMINI_API_KEY;
      if (!key) {
        throw new Error("GEMINI_API_KEY is not configured.");
      }
      this.client = new GoogleGenAI({ apiKey: key });
    }
    return this.client;
  }

  private resolveModel(modelOverride?: string): string {
    return modelOverride || env.server.GEMINI_MODEL || "gemini-2.5-flash";
  }

  /**
   * Generates freeform text response.
   */
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const ai = this.getClient();
    const model = this.resolveModel(options.model);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
        },
      });

      return {
        text: response.text ?? "",
        model,
        finishReason: response.candidates?.[0]?.finishReason ?? "STOP",
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount ?? 0,
              completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: response.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    } catch (err) {
      logger.error(
        "Gemini generateText error",
        err instanceof Error ? err : new Error(String(err))
      );
      throw err;
    }
  }

  /**
   * Generates structured output validated with Zod.
   */
  async generateStructured<T>(
    optionsOrPrompt: GenerateStructuredOptions<T> | string,
    maybeSchema?: z.ZodSchema<T>
  ): Promise<GenerateStructuredResult<T>> {
    let prompt: string;
    let systemInstruction: string | undefined;
    let modelName: string | undefined;
    let parser: ((raw: unknown) => T) | undefined;

    if (typeof optionsOrPrompt === "string") {
      prompt = optionsOrPrompt;
      if (maybeSchema) {
        parser = (raw: unknown) => maybeSchema.parse(raw);
      }
    } else {
      prompt = optionsOrPrompt.prompt;
      systemInstruction = optionsOrPrompt.systemInstruction;
      modelName = optionsOrPrompt.model;
      parser = optionsOrPrompt.parser;
    }

    const ai = this.getClient();
    const model = this.resolveModel(modelName);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text ?? "{}";
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseErr) {
        logger.warn("Failed to parse Gemini structured JSON", { rawText, parseErr });
        throw new Error("Gemini returned invalid JSON");
      }

      const data = parser ? parser(parsedJson) : (parsedJson as T);

      return {
        data,
        rawText,
        model,
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount ?? 0,
              completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: response.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    } catch (err) {
      logger.error(
        "Gemini generateStructured error",
        err instanceof Error ? err : new Error(String(err))
      );
      throw err;
    }
  }

  /**
   * Safe structured output generator returning typed result on error/rate limit.
   */
  async generateStructuredSafe<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemInstruction?: string,
    modelOverride?: string
  ): Promise<LLMResult<T>> {
    try {
      const res = await this.generateStructured<T>({
        prompt,
        systemInstruction,
        model: modelOverride,
        parser: (raw) => schema.parse(raw),
      });
      return { ok: true, data: res.data, rawText: res.rawText, model: res.model };
    } catch (err) {
      if (isRateLimitError(err)) {
        return { ok: false, reason: "rate_limited", details: String(err) };
      }
      return {
        ok: false,
        reason: "error",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Multi-turn function calling with max 3 rounds and 20s overall timeout.
   */
  async generateWithTools(options: GeminiFunctionCallOptions): Promise<GeminiFunctionCallResult> {
    const ai = this.getClient();
    const model = this.resolveModel(options.model);
    const maxRounds = options.maxRounds ?? 3;
    const timeoutMs = options.timeoutMs ?? 20000;

    const timeoutPromise = new Promise<GeminiFunctionCallResult>((resolve) => {
      setTimeout(() => {
        resolve({
          ok: false,
          reason: "timeout",
          details: `Gemini function calling exceeded ${timeoutMs}ms`,
        });
      }, timeoutMs);
    });

    const executionPromise = (async (): Promise<GeminiFunctionCallResult> => {
      try {
        const functionDeclarations: FunctionDeclaration[] = options.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters as unknown as FunctionDeclaration["parameters"],
        }));

        // Conversational message history
        const contents: Content[] = [
          {
            role: "user",
            parts: [{ text: options.prompt }],
          },
        ];

        const toolCallsExecuted: Array<{
          name: string;
          args: Record<string, unknown>;
          result: unknown;
        }> = [];

        for (let round = 0; round < maxRounds; round++) {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: options.systemInstruction,
              tools: [{ functionDeclarations }],
            },
          });

          const functionCalls = response.functionCalls;
          if (!functionCalls || functionCalls.length === 0) {
            // Final natural language response reached
            return {
              ok: true,
              text: response.text ?? "",
              toolCallsExecuted,
              model,
            };
          }

          // Append model turn with function calls
          const candidateParts = response.candidates?.[0]?.content?.parts ?? [];
          contents.push({
            role: "model",
            parts: candidateParts,
          });

          // Execute each function call and record response
          const responseParts: Part[] = [];

          for (const call of functionCalls) {
            const toolName = call.name ?? "";
            const toolArgs = (call.args as Record<string, unknown>) ?? {};

            let toolResult: unknown;
            try {
              toolResult = await options.executeTool(toolName, toolArgs);
            } catch (toolErr) {
              toolResult = { error: toolErr instanceof Error ? toolErr.message : String(toolErr) };
            }

            toolCallsExecuted.push({
              name: toolName,
              args: toolArgs,
              result: toolResult,
            });

            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { result: toolResult },
              },
            });
          }

          // Append user turn containing function responses
          contents.push({
            role: "user",
            parts: responseParts,
          });
        }

        // If exceeded max rounds, request final answer with current context
        const finalResponse = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: options.systemInstruction,
          },
        });

        return {
          ok: true,
          text: finalResponse.text ?? "",
          toolCallsExecuted,
          model,
        };
      } catch (err) {
        if (isRateLimitError(err)) {
          return { ok: false, reason: "rate_limited", details: String(err) };
        }
        return {
          ok: false,
          reason: "error",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }
}
