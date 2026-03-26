import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, existsSync, utimesSync } from 'fs';
import { join } from 'path';
import { rmSync } from 'fs';
import { ToolContextManager } from './context.js';

const TEST_DIR = '/tmp/dexter-context-test-' + process.pid;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

test('cleanupOldContexts removes files older than TTL', async () => {
  // Create a stale JSON file (mtime set to 2 hours ago)
  const staleFile = join(TEST_DIR, 'stale.json');
  writeFileSync(staleFile, '{}');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  utimesSync(staleFile, twoHoursAgo, twoHoursAgo);

  // Create a fresh JSON file
  const freshFile = join(TEST_DIR, 'fresh.json');
  writeFileSync(freshFile, '{}');

  const mgr = new ToolContextManager(TEST_DIR);
  // Call cleanup with 1-hour TTL — stale should be gone, fresh should remain
  await mgr.cleanupOldContexts(1 * 60 * 60 * 1000);

  expect(existsSync(staleFile)).toBe(false);
  expect(existsSync(freshFile)).toBe(true);
});

test('cleanupOldContexts ignores non-JSON files', () => {
  const txtFile = join(TEST_DIR, 'keep.txt');
  writeFileSync(txtFile, 'data');
  const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  utimesSync(txtFile, longAgo, longAgo);

  const mgr = new ToolContextManager(TEST_DIR);
  mgr.cleanupOldContexts(1 * 60 * 60 * 1000);

  expect(existsSync(txtFile)).toBe(true);
});

test('cleanupOldContexts keeps recent files', () => {
  const recentFile = join(TEST_DIR, 'recent.json');
  writeFileSync(recentFile, '{}');

  const mgr = new ToolContextManager(TEST_DIR);
  mgr.cleanupOldContexts(24 * 60 * 60 * 1000);

  expect(existsSync(recentFile)).toBe(true);
});

test('cleanupOldContexts handles missing directory gracefully', () => {
  const mgr = new ToolContextManager(TEST_DIR);
  // Should not throw when called with a nonexistent subdirectory
  expect(() => mgr.cleanupOldContexts()).not.toThrow();
});

test('ToolContextManager creates context directory on construction', () => {
  const newDir = join(TEST_DIR, 'subdir');
  new ToolContextManager(newDir);
  expect(existsSync(newDir)).toBe(true);
});
