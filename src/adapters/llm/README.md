# LLM Adapter (`src/adapters/llm`)

Contains the abstract `LLMProvider` contract for AI generation.

- Primary Provider: Google Gemini (Generative Language SDK)
- Fallback Provider: Groq (ultra-low-latency Llama-3 inference)

Concrete implementations will be built in the feature implementation phase. Offline testing utilizes `tests/mocks/mockLlmProvider.ts`.
