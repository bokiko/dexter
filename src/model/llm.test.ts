import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { getChatModel, clearModelCache } from './llm.js';
import { ToolExecutor } from '../agent/tool-executor.js';

// ============================================================================
// getChatModel — provider routing by model name prefix
// ============================================================================

describe('getChatModel', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.GOOGLE_API_KEY = 'test-google-key';
    clearModelCache();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    clearModelCache();
  });

  test('selects ChatOpenAI for gpt- prefixed models', () => {
    expect(getChatModel('gpt-5.2')).toBeInstanceOf(ChatOpenAI);
    expect(getChatModel('gpt-4o')).toBeInstanceOf(ChatOpenAI);
  });

  test('selects ChatOpenAI for unknown model names (default provider)', () => {
    expect(getChatModel('some-unknown-model')).toBeInstanceOf(ChatOpenAI);
  });

  test('selects ChatAnthropic for claude- prefixed models', () => {
    expect(getChatModel('claude-sonnet-4-5')).toBeInstanceOf(ChatAnthropic);
    expect(getChatModel('claude-3-opus')).toBeInstanceOf(ChatAnthropic);
  });

  test('selects ChatGoogleGenerativeAI for gemini- prefixed models', () => {
    expect(getChatModel('gemini-3')).toBeInstanceOf(ChatGoogleGenerativeAI);
    expect(getChatModel('gemini-1.5-pro')).toBeInstanceOf(ChatGoogleGenerativeAI);
  });

  test('caches model instances by name and streaming flag', () => {
    const first = getChatModel('gpt-5.2', false);
    const second = getChatModel('gpt-5.2', false);
    expect(first).toBe(second);
  });

  test('returns distinct instances for streaming vs non-streaming', () => {
    const nonStreaming = getChatModel('gpt-5.2', false);
    const streaming = getChatModel('gpt-5.2', true);
    expect(nonStreaming).not.toBe(streaming);
  });

  test('clearModelCache forces new instance creation', () => {
    const before = getChatModel('gpt-5.2');
    clearModelCache();
    const after = getChatModel('gpt-5.2');
    expect(before).not.toBe(after);
  });

  test('throws if OPENAI_API_KEY is missing for default provider', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getChatModel('gpt-5.2')).toThrow('OPENAI_API_KEY not found');
  });

  test('throws if ANTHROPIC_API_KEY is missing for claude- models', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getChatModel('claude-sonnet-4-5')).toThrow('ANTHROPIC_API_KEY not found');
  });

  test('throws if GOOGLE_API_KEY is missing for gemini- models', () => {
    delete process.env.GOOGLE_API_KEY;
    expect(() => getChatModel('gemini-3')).toThrow('GOOGLE_API_KEY not found');
  });
});

// ============================================================================
// ToolExecutor.extractToolCalls — AIMessage tool_calls parsing
// ============================================================================

describe('ToolExecutor.extractToolCalls', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    executor = new ToolExecutor({
      tools: [],
      contextManager: {} as any,
    });
  });

  test('returns empty array for null input', () => {
    const result = (executor as any).extractToolCalls(null);
    expect(result).toEqual([]);
  });

  test('returns empty array for non-object input', () => {
    const result = (executor as any).extractToolCalls('not an object');
    expect(result).toEqual([]);
  });

  test('returns empty array when tool_calls is missing', () => {
    const result = (executor as any).extractToolCalls({ content: 'hello' });
    expect(result).toEqual([]);
  });

  test('returns empty array when tool_calls is not an array', () => {
    const result = (executor as any).extractToolCalls({ tool_calls: 'invalid' });
    expect(result).toEqual([]);
  });

  test('parses a single tool call from AIMessage', () => {
    const message = {
      tool_calls: [
        { name: 'get_price', args: { ticker: 'AAPL' } },
      ],
    };
    const result = (executor as any).extractToolCalls(message);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ tool: 'get_price', args: { ticker: 'AAPL' } });
  });

  test('parses multiple tool calls from AIMessage', () => {
    const message = {
      tool_calls: [
        { name: 'get_price', args: { ticker: 'AAPL' } },
        { name: 'get_volume', args: { symbol: 'BTC', days: 7 } },
      ],
    };
    const result = (executor as any).extractToolCalls(message);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tool: 'get_price', args: { ticker: 'AAPL' } });
    expect(result[1]).toEqual({ tool: 'get_volume', args: { symbol: 'BTC', days: 7 } });
  });

  test('maps tool call name to tool field', () => {
    const message = {
      tool_calls: [{ name: 'my_tool', args: {} }],
    };
    const result = (executor as any).extractToolCalls(message);
    expect(result[0].tool).toBe('my_tool');
  });
});

// ============================================================================
// BUG-001 regression: executeTools awaits saveContext before returning
// ============================================================================

describe('ToolExecutor.executeTools awaits saveContext', () => {
  test('saveContext is awaited before executeTools resolves', async () => {
    const saveOrder: string[] = [];

    let resolveSave!: () => void;
    const saveContextPromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });

    const mockContextManager = {
      saveContext: async (..._args: any[]) => {
        // Simulate async disk write
        await saveContextPromise;
        saveOrder.push('saveContext');
      },
    } as any;

    const mockTool = {
      name: 'mock_tool',
      invoke: async (_args: any) => {
        saveOrder.push('toolInvoke');
        return 'tool result';
      },
    } as any;

    const executor = new ToolExecutor({
      tools: [mockTool],
      contextManager: mockContextManager,
    });

    const task = {
      id: 't1',
      description: 'test',
      status: 'pending' as const,
      taskType: 'use_tools' as const,
      toolCalls: [{ tool: 'mock_tool', args: {}, status: 'pending' as const }],
    };

    const executePromise = executor.executeTools(task, 'query-id');

    // Resolve the async saveContext after a tick
    await Promise.resolve();
    resolveSave();

    await executePromise;

    // saveContext must have completed before executeTools returned
    expect(saveOrder).toContain('saveContext');
    expect(saveOrder.indexOf('toolInvoke')).toBeLessThan(saveOrder.indexOf('saveContext'));
  });
});
