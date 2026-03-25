import { ToolContextManager } from '../utils/context.js';
import { MessageHistory } from '../utils/message-history.js';
import { callLlmStream } from '../model/llm.js';
import { TOOLS } from '../tools/index.js';
import { UnderstandPhase } from './phases/understand.js';
import { PlanPhase } from './phases/plan.js';
import { ExecutePhase } from './phases/execute.js';
import { ToolExecutor } from './tool-executor.js';
import { TaskExecutor, TaskExecutorCallbacks } from './task-executor.js';
import { 
  getFinalAnswerSystemPrompt, 
  buildFinalAnswerUserPrompt,
} from './prompts.js';
import type { 
  Phase, 
  Plan, 
  Understanding,
  TaskResult,
  ToolCallStatus,
} from './state.js';

// ============================================================================
// Callbacks Interface
// ============================================================================

/**
 * Callbacks for observing agent execution.
 */
export interface AgentCallbacks extends TaskExecutorCallbacks {
  // Phase transitions
  onPhaseStart?: (phase: Phase) => void;
  onPhaseComplete?: (phase: Phase) => void;

  // Understanding
  onUnderstandingComplete?: (understanding: Understanding) => void;

  // Planning
  onPlanCreated?: (plan: Plan) => void;

  // Answer
  onAnswerStart?: () => void;
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;
}

// ============================================================================
// Agent Options
// ============================================================================

export interface AgentOptions {
  model: string;
  callbacks?: AgentCallbacks;
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Agent - Planning with just-in-time tool selection and parallel task execution.
 * 
 * Architecture:
 * 1. Understand: Extract intent and entities from query
 * 2. Plan: Create task list with taskType and dependencies
 * 3. Execute: Run tasks with just-in-time tool selection (gpt-5-mini)
 * 4. Answer: Synthesize final answer from task results
 */
export class Agent {
  private readonly model: string;
  private callbacks: AgentCallbacks;
  private readonly contextManager: ToolContextManager;

  private readonly understandPhase: UnderstandPhase;
  private readonly planPhase: PlanPhase;
  private readonly taskExecutor: TaskExecutor;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.callbacks = options.callbacks ?? {};
    this.contextManager = new ToolContextManager('.dexter/context', this.model);

    // Initialize phases
    this.understandPhase = new UnderstandPhase({ model: this.model });
    this.planPhase = new PlanPhase({ model: this.model });
    const executePhase = new ExecutePhase({ model: this.model });

    // Initialize executors
    const toolExecutor = new ToolExecutor({
      tools: TOOLS,
      contextManager: this.contextManager,
    });

    this.taskExecutor = new TaskExecutor({
      model: this.model,
      toolExecutor,
      executePhase,
      contextManager: this.contextManager,
    });
  }

  /**
   * Main entry point - runs the agent on a user query.
   */
  async run(query: string, messageHistory?: MessageHistory, options?: { callbacks?: AgentCallbacks; signal?: AbortSignal }): Promise<string> {
    const callbacks: AgentCallbacks = options?.callbacks ?? this.callbacks;
    const signal = options?.signal;

    const taskResults: Map<string, TaskResult> = new Map();

    // ========================================================================
    // Phase 1: Understand
    // ========================================================================
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    callbacks.onPhaseStart?.('understand');

    const understanding = await this.understandPhase.run({
      query,
      conversationHistory: messageHistory,
    });

    callbacks.onUnderstandingComplete?.(understanding);
    callbacks.onPhaseComplete?.('understand');

    // ========================================================================
    // Phase 2: Plan (with taskType and dependencies)
    // ========================================================================
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    callbacks.onPhaseStart?.('plan');

    const plan = await this.planPhase.run({
      query,
      understanding,
    });

    callbacks.onPlanCreated?.(plan);
    callbacks.onPhaseComplete?.('plan');

    // ========================================================================
    // Phase 3: Execute Tasks with Parallelization
    // Tool selection happens just-in-time during execution
    // ========================================================================
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    callbacks.onPhaseStart?.('execute');

    await this.taskExecutor.executeTasks(
      query,
      plan,
      understanding,
      taskResults,
      callbacks
    );

    callbacks.onPhaseComplete?.('execute');

    // ========================================================================
    // Phase 4: Generate Final Answer
    // ========================================================================
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return this.generateFinalAnswer(query, plan, taskResults, callbacks);
  }

  /**
   * Generates the final answer from all task results.
   */
  private async generateFinalAnswer(
    query: string,
    plan: Plan,
    taskResults: Map<string, TaskResult>,
    callbacks: AgentCallbacks
  ): Promise<string> {
    callbacks.onAnswerStart?.();

    // Format task outputs
    const taskOutputs = plan.tasks
      .map(task => {
        const result = taskResults.get(task.id);
        const output = result?.output ?? 'No output';
        return `Task: ${task.description}\nOutput: ${output}`;
      })
      .join('\n\n---\n\n');

    // Collect sources from context manager
    const queryId = this.contextManager.hashQuery(query);
    const pointers = this.contextManager.getPointersForQuery(queryId);
    
    const sources = pointers
      .filter(p => p.sourceUrls && p.sourceUrls.length > 0)
      .map(p => ({
        description: p.toolDescription,
        urls: p.sourceUrls!,
      }));

    const sourcesStr = sources.length > 0
      ? sources.map(s => `${s.description}: ${s.urls.join(', ')}`).join('\n')
      : '';

    // Build the final answer prompt
    const systemPrompt = getFinalAnswerSystemPrompt();
    const userPrompt = buildFinalAnswerUserPrompt(query, taskOutputs, sourcesStr);

    // Stream the answer in real-time to the callback while collecting for return value
    const rawStream = callLlmStream(userPrompt, {
      systemPrompt,
      model: this.model,
    });

    const chunks: string[] = [];

    if (callbacks.onAnswerStream) {
      // Broadcast chunks to the callback in real-time using an async queue
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
        chunks.push(chunk);
        pending.push(chunk);
        notifiers.splice(0).forEach((fn) => fn());
      }
      streamDone = true;
      notifiers.splice(0).forEach((fn) => fn());
    } else {
      for await (const chunk of rawStream) {
        chunks.push(chunk);
      }
    }

    return chunks.join('');
  }
}
