import { test, expect, describe } from 'bun:test';
import { TaskExecutor } from './task-executor.js';
import type { Plan, Understanding, TaskResult } from './state.js';

// ===== Mock helpers =====

function createMockContextManager() {
  return {
    hashQuery: (_query: string) => 'test-query-id',
    getPointersForQuery: (_queryId: string) => [],
    loadContexts: async (_filepaths: string[]) => [],
  } as any;
}

function createMockExecutePhase(output: string = 'reason output') {
  return {
    run: async ({ task }: any) => ({
      taskId: task.id,
      output,
    }),
  } as any;
}

function createMockToolExecutor(
  selectResult: any[] = [],
  executeResult: boolean = true
) {
  return {
    selectTools: async (_task: any, _understanding: any) => selectResult,
    executeTools: async (_task: any, _queryId: string, _callbacks?: any) => executeResult,
  } as any;
}

const EMPTY_UNDERSTANDING: Understanding = {
  intent: 'test',
  entities: [],
};

// ===== Tests =====

describe('TaskExecutor.executeTasks', () => {
  test('executes a single reason task with no dependencies', async () => {
    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(),
      executePhase: createMockExecutePhase('analysis done'),
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: 'test plan',
      tasks: [
        { id: 't1', description: 'analyze', status: 'pending', taskType: 'reason' },
      ],
    };
    const results = new Map<string, TaskResult>();

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results);

    expect(results.get('t1')?.output).toBe('analysis done');
  });

  test('executes linear dependency chain in order', async () => {
    const executionOrder: string[] = [];

    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(),
      executePhase: {
        run: async ({ task }: any) => {
          executionOrder.push(task.id);
          return { taskId: task.id, output: `done:${task.id}` };
        },
      } as any,
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 't1', description: 'first', status: 'pending', taskType: 'reason', dependsOn: [] },
        { id: 't2', description: 'second', status: 'pending', taskType: 'reason', dependsOn: ['t1'] },
        { id: 't3', description: 'third', status: 'pending', taskType: 'reason', dependsOn: ['t2'] },
      ],
    };
    const results = new Map<string, TaskResult>();

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results);

    expect(executionOrder).toEqual(['t1', 't2', 't3']);
    expect(results.get('t3')?.output).toBe('done:t3');
  });

  test('executes parallel tasks when no dependencies between them', async () => {
    const started: string[] = [];

    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(),
      executePhase: {
        run: async ({ task }: any) => {
          started.push(task.id);
          return { taskId: task.id, output: `done:${task.id}` };
        },
      } as any,
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 'a', description: 'task a', status: 'pending', taskType: 'reason' },
        { id: 'b', description: 'task b', status: 'pending', taskType: 'reason' },
        { id: 'c', description: 'task c', status: 'pending', taskType: 'reason' },
      ],
    };
    const results = new Map<string, TaskResult>();

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results);

    expect(started).toHaveLength(3);
    expect(results.size).toBe(3);
  });

  test('detects dependency cycle and marks all stuck tasks as failed', async () => {
    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(),
      executePhase: createMockExecutePhase(),
      contextManager: createMockContextManager(),
    });

    // A depends on B, B depends on A — cycle
    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 'a', description: 'task a', status: 'pending', taskType: 'reason', dependsOn: ['b'] },
        { id: 'b', description: 'task b', status: 'pending', taskType: 'reason', dependsOn: ['a'] },
      ],
    };
    const results = new Map<string, TaskResult>();
    const failedIds: string[] = [];

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results, {
      onTaskUpdate: (taskId, status) => {
        if (status === 'failed') failedIds.push(taskId);
      },
    });

    expect(failedIds).toContain('a');
    expect(failedIds).toContain('b');
    expect(results.get('a')?.output).toMatch(/dependency cycle/);
    expect(results.get('b')?.output).toMatch(/dependency cycle/);
  });

  test('marks task with unknown taskType as failed', async () => {
    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(),
      executePhase: createMockExecutePhase(),
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 't1', description: 'weird task', status: 'pending', taskType: 'unknown' as any },
      ],
    };
    const results = new Map<string, TaskResult>();
    let lastStatus = '';

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results, {
      onTaskUpdate: (_id, status) => { lastStatus = status; },
    });

    expect(lastStatus).toBe('failed');
    expect(results.get('t1')?.output).toMatch(/unknown task type/);
  });

  test('use_tools task populates results with tool names', async () => {
    const mockToolCalls = [
      { tool: 'get_price', args: { ticker: 'AAPL' }, status: 'pending' as const },
    ];

    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(mockToolCalls, true),
      executePhase: createMockExecutePhase(),
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 't1', description: 'get price', status: 'pending', taskType: 'use_tools' },
      ],
    };
    const results = new Map<string, TaskResult>();

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results);

    expect(results.get('t1')?.output).toContain('get_price');
  });

  test('use_tools task reports failure when executeTools returns false', async () => {
    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(
        [{ tool: 'search_web', args: {}, status: 'failed' as const }],
        false
      ),
      executePhase: createMockExecutePhase(),
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 't1', description: 'search', status: 'pending', taskType: 'use_tools' },
      ],
    };
    const results = new Map<string, TaskResult>();
    let lastStatus = '';

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results, {
      onTaskUpdate: (_id, status) => { lastStatus = status; },
    });

    expect(lastStatus).toBe('failed');
    expect(results.get('t1')?.output).toMatch(/Failed to gather data/);
  });

  test('use_tools task with no tool calls still completes successfully', async () => {
    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor([], true),
      executePhase: createMockExecutePhase(),
      contextManager: createMockContextManager(),
    });

    const plan: Plan = {
      summary: '',
      tasks: [
        { id: 't1', description: 'empty tools task', status: 'pending', taskType: 'use_tools' },
      ],
    };
    const results = new Map<string, TaskResult>();
    let lastStatus = '';

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results, {
      onTaskUpdate: (_id, status) => { lastStatus = status; },
    });

    expect(lastStatus).toBe('completed');
    expect(results.get('t1')?.output).toContain('none');
  });

  test('handles empty plan with no tasks', async () => {
    const executor = new TaskExecutor({
      model: 'test-model',
      toolExecutor: createMockToolExecutor(),
      executePhase: createMockExecutePhase(),
      contextManager: createMockContextManager(),
    });

    const plan: Plan = { summary: '', tasks: [] };
    const results = new Map<string, TaskResult>();

    await executor.executeTasks('query', plan, EMPTY_UNDERSTANDING, results);

    expect(results.size).toBe(0);
  });
});
