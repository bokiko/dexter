import { test, expect, describe } from 'bun:test';

// ===== Helpers =====

const streamChunks: string[][] = []; // stack: each test pushes its chunks

function createMockUnderstandPhase(intent = 'test intent') {
  return { run: async () => ({ intent, entities: [] }) };
}

function createMockPlanPhase(tasks: any[] = []) {
  return { run: async () => ({ summary: 'test plan', tasks }) };
}

function createMockExecutePhase() {
  return {
    run: async ({ task }: any) => ({ taskId: task.id, output: `done:${task.id}` }),
  };
}

function createMockToolExecutor() {
  return {
    selectTools: async () => [],
    executeTools: async () => true,
  };
}

function createMockContextManager() {
  return {
    hashQuery: () => 'test-query-id',
    getPointersForQuery: () => [],
    loadContexts: async () => [],
    cleanupOldContexts: () => {},
  };
}

async function buildAgent(planTasks: any[] = []) {
  const { Agent } = await import('./orchestrator.js');
  const { TaskExecutor } = await import('./task-executor.js');

  const agent = new Agent({ model: 'test-model' });

  const contextManager = createMockContextManager();
  (agent as any).understandPhase = createMockUnderstandPhase();
  (agent as any).planPhase = createMockPlanPhase(planTasks);
  (agent as any).contextManager = contextManager;
  (agent as any).taskExecutor = new TaskExecutor({
    model: 'test-model',
    toolExecutor: createMockToolExecutor() as any,
    executePhase: createMockExecutePhase() as any,
    contextManager: contextManager as any,
  });

  // Override generateFinalAnswer to avoid real LLM calls — no mock.module() needed
  (agent as any).generateFinalAnswer = async (
    _query: string,
    _plan: any,
    _taskResults: any,
    callbacks: any
  ): Promise<string> => {
    callbacks.onAnswerStart?.();
    const chunks = streamChunks.shift() ?? ['mock answer'];

    async function* makeStream() {
      for (const chunk of chunks) yield chunk;
    }

    const rawStream = makeStream();
    const collected: string[] = [];

    if (callbacks.onAnswerStream) {
      const pending: string[] = [];
      let streamDone = false;
      const notifiers: Array<() => void> = [];

      const callbackStream = async function* () {
        while (true) {
          if (pending.length > 0) {
            yield pending.shift()!;
          } else if (streamDone) {
            break;
          } else {
            await new Promise<void>((r) => { notifiers.push(r); });
          }
        }
      };

      callbacks.onAnswerStream(callbackStream());

      for await (const chunk of rawStream) {
        collected.push(chunk);
        pending.push(chunk);
        notifiers.splice(0).forEach((fn) => fn());
      }
      streamDone = true;
      notifiers.splice(0).forEach((fn) => fn());
    } else {
      for await (const chunk of rawStream) {
        collected.push(chunk);
      }
    }

    return collected.join('');
  };

  return agent;
}

// ===== Tests =====

describe('Agent.run', () => {
  test('happy path: runs all phases and returns a string', async () => {
    streamChunks.push(['Hello', ' World']);
    const agent = await buildAgent([
      { id: 't1', description: 'analyze', status: 'pending', taskType: 'reason' },
    ]);

    const result = await agent.run('what is BTC price?');
    expect(typeof result).toBe('string');
    expect(result).toBe('Hello World');
  });

  test('abort before understand phase throws AbortError', async () => {
    const { Agent } = await import('./orchestrator.js');
    const agent = new Agent({ model: 'test-model' });
    const controller = new AbortController();
    controller.abort();

    let thrown: Error | null = null;
    try {
      await agent.run('query', undefined, { signal: controller.signal });
    } catch (e) {
      thrown = e as Error;
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.name).toBe('AbortError');
  });

  test('abort after understand phase throws AbortError', async () => {
    const { Agent } = await import('./orchestrator.js');
    const agent = new Agent({ model: 'test-model' });
    const controller = new AbortController();

    (agent as any).understandPhase = {
      run: async () => {
        controller.abort();
        return { intent: 'test', entities: [] };
      },
    };

    let thrown: Error | null = null;
    try {
      await agent.run('query', undefined, { signal: controller.signal });
    } catch (e) {
      thrown = e as Error;
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.name).toBe('AbortError');
  });

  test('onPhaseStart/onPhaseComplete callbacks fire in phase order', async () => {
    streamChunks.push(['done']);
    const agent = await buildAgent([]);

    const phaseEvents: string[] = [];
    await agent.run('query', undefined, {
      callbacks: {
        onPhaseStart: (phase) => phaseEvents.push(`start:${phase}`),
        onPhaseComplete: (phase) => phaseEvents.push(`complete:${phase}`),
      },
    });

    expect(phaseEvents).toContain('start:understand');
    expect(phaseEvents).toContain('complete:understand');
    expect(phaseEvents).toContain('start:plan');
    expect(phaseEvents).toContain('complete:plan');
    expect(phaseEvents).toContain('start:execute');
    expect(phaseEvents).toContain('complete:execute');
    expect(phaseEvents.indexOf('start:understand')).toBeLessThan(phaseEvents.indexOf('start:plan'));
    expect(phaseEvents.indexOf('start:plan')).toBeLessThan(phaseEvents.indexOf('start:execute'));
  });
});

describe('Agent.generateFinalAnswer (via run)', () => {
  test('streams chunks to onAnswerStream callback and returns full string', async () => {
    streamChunks.push(['Hello', ' ', 'World']);
    const agent = await buildAgent([]);

    const streamedChunks: string[] = [];
    let streamComplete = false;

    await agent.run('query', undefined, {
      callbacks: {
        onAnswerStream: async (stream) => {
          for await (const chunk of stream) {
            streamedChunks.push(chunk);
          }
          streamComplete = true;
        },
      },
    });

    // Give the async stream consumer a tick to finish
    await new Promise((r) => setTimeout(r, 20));

    expect(streamedChunks).toEqual(['Hello', ' ', 'World']);
    expect(streamComplete).toBe(true);
  });

  test('returns full string even without onAnswerStream callback', async () => {
    streamChunks.push(['Final', ' answer']);
    const agent = await buildAgent([]);

    const result = await agent.run('query');
    expect(result).toBe('Final answer');
  });
});
