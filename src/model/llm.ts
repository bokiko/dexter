import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import { z } from 'zod';

const DEFAULT_SYSTEM_PROMPT = `You are Dexter, an autonomous financial and crypto research agent.
Your primary objective is to conduct deep and thorough research on stocks, companies, cryptocurrencies, and DeFi protocols to answer user queries.
You are equipped with powerful tools for:
- Traditional finance: stock prices, financial statements, SEC filings, analyst estimates
- Crypto markets: token prices, market data, trending coins, fear & greed index
- DeFi analytics: TVL data, protocol metrics, yield opportunities, DEX volumes

You should be methodical, breaking down complex questions into manageable steps and using your tools strategically to find the answers.
Always aim to provide accurate, comprehensive, and well-structured information to the user.`;

export const DEFAULT_MODEL = 'gpt-5.2';

// Generic retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

// Model provider configuration
interface ModelOpts {
  streaming: boolean;
}

type ModelFactory = (name: string, opts: ModelOpts) => BaseChatModel;

function getApiKey(envVar: string, providerName: string): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(`${envVar} not found. Please set your ${providerName} API key in .env`);
  }
  return apiKey;
}

const MODEL_PROVIDERS: Record<string, ModelFactory> = {
  'claude-': (name, opts) =>
    new ChatAnthropic({
      model: name,
      ...opts,
      apiKey: getApiKey('ANTHROPIC_API_KEY', 'Anthropic'),
    }),
  'gemini-': (name, opts) =>
    new ChatGoogleGenerativeAI({
      model: name,
      ...opts,
      apiKey: getApiKey('GOOGLE_API_KEY', 'Google'),
    }),
};

const DEFAULT_PROVIDER: ModelFactory = (name, opts) =>
  new ChatOpenAI({
    model: name,
    ...opts,
    apiKey: getApiKey('OPENAI_API_KEY', 'OpenAI'),
  });

const modelCache = new Map<string, BaseChatModel>();

// Cached prompt template — structure is always system+user, content injected at invoke time
const cachedPromptTemplate = ChatPromptTemplate.fromMessages([
  ['system', '{systemPrompt}'],
  ['user', '{prompt}'],
]);

export function clearModelCache(): void {
  modelCache.clear();
}

export function getChatModel(
  modelName: string = DEFAULT_MODEL,
  streaming: boolean = false
): BaseChatModel {
  const cacheKey = `${modelName}:${streaming}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey)!;
  const opts: ModelOpts = { streaming };
  const prefix = Object.keys(MODEL_PROVIDERS).find((p) => modelName.startsWith(p));
  const factory = prefix ? MODEL_PROVIDERS[prefix] : DEFAULT_PROVIDER;
  const model = factory(modelName, opts);
  modelCache.set(cacheKey, model);
  return model;
}

interface CallLlmOptions {
  model?: string;
  systemPrompt?: string;
  outputSchema?: z.ZodType<unknown>;
  tools?: StructuredToolInterface[];
}

export async function callLlm(prompt: string, options: CallLlmOptions = {}): Promise<unknown> {
  const { model = DEFAULT_MODEL, systemPrompt, outputSchema, tools } = options;
  const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const llm = getChatModel(model, false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runnable: Runnable<any, any> = llm;

  if (outputSchema) {
    runnable = llm.withStructuredOutput(outputSchema);
  } else if (tools && tools.length > 0 && llm.bindTools) {
    runnable = llm.bindTools(tools);
  }

  const chain = cachedPromptTemplate.pipe(runnable);

  const result = await withRetry(() => chain.invoke({ prompt, systemPrompt: finalSystemPrompt }));

  // If no outputSchema and no tools, extract content from AIMessage
  // When tools are provided, return the full AIMessage to preserve tool_calls
  if (!outputSchema && !tools && result && typeof result === 'object' && 'content' in result) {
    return (result as { content: string }).content;
  }
  return result;
}

export async function* callLlmStream(
  prompt: string,
  options: { model?: string; systemPrompt?: string } = {}
): AsyncGenerator<string> {
  const { model = DEFAULT_MODEL, systemPrompt } = options;
  const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const llm = getChatModel(model, true);
  const chain = cachedPromptTemplate.pipe(llm);

  for (let attempt = 0; attempt < 3; attempt++) {
    let chunksYielded = 0;
    try {
      const stream = await chain.stream({ prompt, systemPrompt: finalSystemPrompt });
      for await (const chunk of stream) {
        if (chunk && typeof chunk === 'object' && 'content' in chunk) {
          const content = chunk.content;
          if (content && typeof content === 'string') {
            chunksYielded++;
            yield content;
          }
        }
      }
      return;
    } catch (e) {
      // Only retry if no chunks were yielded yet; retrying after partial output would duplicate content
      if (attempt === 2 || chunksYielded > 0) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}
