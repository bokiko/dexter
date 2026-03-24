import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { DEFAULT_MODEL } from '../model/llm.js';
import type { ToolSummary } from '../agent/schemas.js';

interface ContextPointer {
  filepath: string;
  filename: string;
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  taskId?: number;
  queryId?: string;
  sourceUrls?: string[];
}

interface ContextData {
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  timestamp: string;
  taskId?: number;
  queryId?: string;
  sourceUrls?: string[];
  result: unknown;
}

export class ToolContextManager {
  private contextDir: string;
  private model: string;
  public pointers: ContextPointer[] = [];

  constructor(contextDir: string = '.dexter/context', model: string = DEFAULT_MODEL) {
    this.contextDir = contextDir;
    this.model = model;
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true, mode: 0o700 });
    }
    this.cleanupOldContexts();
  }

  /**
   * Deletes context files older than the given TTL (default: 24 hours).
   * Called at startup to prevent unbounded disk growth.
   */
  cleanupOldContexts(ttlMs: number = 24 * 60 * 60 * 1000): void {
    if (!existsSync(this.contextDir)) return;
    const now = Date.now();
    try {
      const files = readdirSync(this.contextDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filepath = join(this.contextDir, file);
        try {
          const stat = statSync(filepath);
          if (now - stat.mtimeMs > ttlMs) {
            unlinkSync(filepath);
          }
        } catch {
          // Ignore individual file errors
        }
      }
    } catch {
      // Ignore errors if directory cannot be read
    }
  }

  private hashArgs(args: Record<string, unknown>): string {
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    return createHash('md5').update(argsStr).digest('hex').slice(0, 12);
  }

  hashQuery(query: string): string {
    return createHash('md5').update(query).digest('hex').slice(0, 12);
  }

  private generateFilename(toolName: string, args: Record<string, unknown>): string {
    const argsHash = this.hashArgs(args);
    const ticker = typeof args.ticker === 'string' ? args.ticker.toUpperCase() : null;
    return ticker 
      ? `${ticker}_${toolName}_${argsHash}.json`
      : `${toolName}_${argsHash}.json`;
  }

  /**
   * Creates a simple description string for the tool using the tool name and arguments.
   * The description string is used to identify the tool and is used to select relevant context for the query.
   */
  getToolDescription(toolName: string, args: Record<string, unknown>): string {
    const parts: string[] = [];
    const usedKeys = new Set<string>();

    // Add ticker if present (most common identifier)
    if (args.ticker) {
      parts.push(String(args.ticker).toUpperCase());
      usedKeys.add('ticker');
    }

    // Add search query if present
    if (args.query) {
      parts.push(`"${args.query}"`);
      usedKeys.add('query');
    }

    // Format tool name: get_income_statements -> income statements
    const formattedToolName = toolName
      .replace(/^get_/, '')
      .replace(/^search_/, '')
      .replace(/_/g, ' ');
    parts.push(formattedToolName);

    // Add period qualifier if present
    if (args.period) {
      parts.push(`(${args.period})`);
      usedKeys.add('period');
    }

    // Add limit if present
    if (args.limit && typeof args.limit === 'number') {
      parts.push(`- ${args.limit} periods`);
      usedKeys.add('limit');
    }

    // Add date range if present
    if (args.start_date && args.end_date) {
      parts.push(`from ${args.start_date} to ${args.end_date}`);
      usedKeys.add('start_date');
      usedKeys.add('end_date');
    }

    // Append any remaining args not explicitly handled
    const remainingArgs = Object.entries(args)
      .filter(([key]) => !usedKeys.has(key))
      .map(([key, value]) => `${key}=${value}`);

    if (remainingArgs.length > 0) {
      parts.push(`[${remainingArgs.join(', ')}]`);
    }

    return parts.join(' ');
  }

  async saveContext(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    taskId?: number,
    queryId?: string
  ): Promise<string> {
    const filename = this.generateFilename(toolName, args);
    const filepath = join(this.contextDir, filename);

    const toolDescription = this.getToolDescription(toolName, args);

    // Extract sourceUrls from ToolResult format
    let sourceUrls: string[] | undefined;
    let actualResult = result;

    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed.data !== undefined) {
          sourceUrls = parsed.sourceUrls;
          actualResult = parsed.data;
        }
      } catch {
        // Result is not JSON, use as-is
      }
    }

    const contextData: ContextData = {
      toolName: toolName,
      args: args,
      toolDescription: toolDescription,
      timestamp: new Date().toISOString(),
      taskId: taskId,
      queryId: queryId,
      sourceUrls: sourceUrls,
      result: actualResult,
    };

    await writeFile(filepath, JSON.stringify(contextData, null, 2), { mode: 0o600 });

    const pointer: ContextPointer = {
      filepath,
      filename,
      toolName,
      args,
      toolDescription,
      taskId,
      queryId,
      sourceUrls,
    };

    this.pointers.push(pointer);

    return filepath;
  }

  /**
   * Saves context to disk and returns a lightweight ToolSummary for the agent loop.
   * Combines saveContext + deterministic summary generation in one call.
   */
  async saveAndGetSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    queryId?: string
  ): Promise<ToolSummary> {
    const filepath = await this.saveContext(toolName, args, result, undefined, queryId);
    const summary = this.getToolDescription(toolName, args);

    return {
      id: filepath,
      toolName,
      args,
      summary,
    };
  }

  getAllPointers(): ContextPointer[] {
    return [...this.pointers];
  }

  getPointersForQuery(queryId: string): ContextPointer[] {
    return this.pointers.filter(p => p.queryId === queryId);
  }

  async loadContexts(filepaths: string[]): Promise<ContextData[]> {
    const results = await Promise.all(
      filepaths.map(async (filepath) => {
        try {
          const content = await readFile(filepath, 'utf-8');
          return JSON.parse(content) as ContextData;
        } catch (e) {
          console.warn(`Warning: Failed to load context file ${filepath}: ${e}`);
          return null;
        }
      })
    );
    return results.filter((ctx): ctx is ContextData => ctx !== null);
  }

}

