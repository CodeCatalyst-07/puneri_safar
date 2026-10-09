/**
 * @file src/adapters/llm/index.ts
 * Type definitions and contract interface for Large Language Model providers.
 *
 * All generative AI calls (Google Gemini, Groq fallback) must conform to this interface.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  /** Override default model configured in environment */
  model?: string;
  messages?: LLMMessage[];
}

export interface GenerateTextResult {
  text: string;
  model: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  /** JSON schema or description guiding the structured output */
  schemaDescription?: string;
  /** Parser function to validate and instantiate the structured shape */
  parser?: (rawJson: unknown) => T;
}

export interface GenerateStructuredResult<T> {
  data: T;
  rawText: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Universal LLM Provider Contract.
 * Allows seamless switching between Google Gemini and Groq without altering domain logic.
 */
export interface LLMProvider {
  /** Identifier of the provider (e.g. 'gemini' | 'groq') */
  readonly providerName: string;

  /**
   * Generates freeform text response based on prompt and conversational context.
   */
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;

  /**
   * Generates type-safe JSON structured data based on schema instructions.
   */
  generateStructured<T>(
    options: GenerateStructuredOptions<T>
  ): Promise<GenerateStructuredResult<T>>;
}

/**
 * Placeholder configuration for Google Gemini Provider (Implementation in future phase)
 */
export interface GeminiProviderConfig {
  apiKey: string;
  defaultModel: string;
}

/**
 * Placeholder configuration for Groq Provider (Implementation in future phase)
 */
export interface GroqProviderConfig {
  apiKey: string;
  defaultModel: string;
}

export * from "./gemini";
