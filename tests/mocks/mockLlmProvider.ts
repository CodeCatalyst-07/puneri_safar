/**
 * @file tests/mocks/mockLlmProvider.ts
 * Offline mock for LLM operations supporting text, structured, and tool calling simulation.
 */

import {
  LLMProvider,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateStructuredOptions,
  GenerateStructuredResult,
} from "@/adapters/llm";
import { GeminiFunctionCallOptions, GeminiFunctionCallResult } from "@/adapters/llm/gemini";

export class MockLLMProvider implements LLMProvider {
  readonly providerName = "mock-llm";
  public simulateRateLimit = false;
  public simulateTimeout = false;
  public toolCallsToSimulate: Array<{ name: string; args: Record<string, unknown> }> = [];
  public customAnswer?: string;

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    return {
      text: this.customAnswer ?? `[Mock LLM response for: "${options.prompt.slice(0, 30)}..."]`,
      model: options.model ?? "mock-gemini-model",
      finishReason: "STOP",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  }

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>
  ): Promise<GenerateStructuredResult<T>> {
    const mockData = options.parser
      ? options.parser({ mock: true })
      : ({ mock: true } as unknown as T);

    return {
      data: mockData,
      rawText: JSON.stringify(mockData),
      model: options.model ?? "mock-gemini-model",
      usage: {
        promptTokens: 15,
        completionTokens: 25,
        totalTokens: 40,
      },
    };
  }

  async generateWithTools(options: GeminiFunctionCallOptions): Promise<GeminiFunctionCallResult> {
    if (this.simulateRateLimit) {
      return { ok: false, reason: "rate_limited", details: "Mock 429 quota exceeded" };
    }
    if (this.simulateTimeout) {
      return { ok: false, reason: "timeout", details: "Mock 20s timeout exceeded" };
    }

    const toolCallsExecuted: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    }> = [];

    for (const call of this.toolCallsToSimulate) {
      const res = await options.executeTool(call.name, call.args);
      toolCallsExecuted.push({
        name: call.name,
        args: call.args,
        result: res,
      });
    }

    return {
      ok: true,
      text:
        this.customAnswer ??
        `Mock verbalized fact summary based on ${toolCallsExecuted.length} executed tools.`,
      toolCallsExecuted,
      model: "mock-gemini-model",
    };
  }
}
