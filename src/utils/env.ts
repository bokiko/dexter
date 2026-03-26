import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';
import { clearModelCache } from '../model/llm.js';

// Load .env on module import
config({ quiet: true });

// Map API key names to user-friendly provider names
const API_KEY_PROVIDER_NAMES: Record<string, string> = {
  OPENAI_API_KEY: 'OpenAI',
  ANTHROPIC_API_KEY: 'Anthropic',
  GOOGLE_API_KEY: 'Google',
};

export function getApiKeyName(modelId: string): string | undefined {
  if (modelId.startsWith('claude-')) return 'ANTHROPIC_API_KEY';
  if (modelId.startsWith('gemini-')) return 'GOOGLE_API_KEY';
  return 'OPENAI_API_KEY';
}

export function checkApiKeyExists(apiKeyName: string): boolean {
  const value = process.env[apiKeyName];
  if (value && value.trim() && !value.trim().startsWith('your-')) {
    return true;
  }

  // Also check .env file directly
  if (existsSync('.env')) {
    const envContent = readFileSync('.env', 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key.trim() === apiKeyName) {
          const val = valueParts.join('=').trim();
          if (val && !val.startsWith('your-')) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function saveApiKeyToEnv(apiKeyName: string, apiKeyValue: string): boolean {
  try {
    let lines: string[] = [];
    let keyUpdated = false;

    if (existsSync('.env')) {
      const existingContent = readFileSync('.env', 'utf-8');
      const existingLines = existingContent.split('\n');

      for (const line of existingLines) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) {
          lines.push(line);
        } else if (stripped.includes('=')) {
          const key = stripped.split('=')[0].trim();
          if (key === apiKeyName) {
            const sanitized = apiKeyValue.replace(/[\r\n]/g, '');
            if (!sanitized) {
              throw new Error('API key cannot be empty');
            }
            lines.push(`${apiKeyName}=${sanitized}`);
            keyUpdated = true;
          } else {
            lines.push(line);
          }
        } else {
          lines.push(line);
        }
      }

      if (!keyUpdated) {
        if (lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
          lines.push('');
        }
        const sanitized = apiKeyValue.replace(/[\r\n]/g, '');
        if (!sanitized) {
          throw new Error('API key cannot be empty');
        }
        lines.push(`${apiKeyName}=${sanitized}`);
      }
    } else {
      lines.push('# LLM API Keys');
      const sanitized = apiKeyValue.replace(/[\r\n]/g, '');
      if (!sanitized) {
        throw new Error('API key cannot be empty');
      }
      lines.push(`${apiKeyName}=${sanitized}`);
    }

    writeFileSync('.env', lines.join('\n'), { mode: 0o600 });

    // Reload environment variables and clear cached model instances
    config({ override: true, quiet: true });
    clearModelCache();

    return true;
  } catch (e) {
    console.error('Error saving API key to .env file:', e instanceof Error ? e.message : 'unknown error');
    return false;
  }
}

export async function promptForApiKey(apiKeyName: string): Promise<string | null> {
  const providerName = API_KEY_PROVIDER_NAMES[apiKeyName] || apiKeyName;

  console.log(`\n${providerName} API key is required to continue.`);
  console.log(`Please enter your ${apiKeyName}:`);

  // Use raw mode to suppress echo of the API key (security: prevent terminal scrollback capture)
  return new Promise((resolve) => {
    // Fall back to non-masked readline if stdin is not a TTY (e.g., piped input)
    if (!process.stdin.isTTY) {
      process.stdout.write('> ');
      let data = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.once('data', (chunk) => {
        data += chunk;
        const apiKey = data.split('\n')[0].trim();
        process.stdout.write('\n');
        if (!apiKey) {
          console.log('No API key entered. Cancelled.');
          resolve(null);
        } else {
          resolve(apiKey);
        }
      });
      return;
    }

    process.stdout.write('> ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    let apiKey = '';

    const onData = (char: string) => {
      if (char === '\r' || char === '\n') {
        // Enter key: finish input
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        const trimmed = apiKey.trim();
        if (!trimmed) {
          console.log('No API key entered. Cancelled.');
          resolve(null);
        } else {
          resolve(trimmed);
        }
      } else if (char === '\u0003') {
        // Ctrl+C: cancel
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        console.log('Cancelled.');
        resolve(null);
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        if (apiKey.length > 0) {
          apiKey = apiKey.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        apiKey += char;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}

export async function ensureApiKeyForModel(modelId: string): Promise<boolean> {
  const apiKeyName = getApiKeyName(modelId);
  if (!apiKeyName) {
    console.log(`Warning: Unknown model '${modelId}', cannot verify API key.`);
    return false;
  }

  // Check if API key already exists
  if (checkApiKeyExists(apiKeyName)) {
    return true;
  }

  // Prompt user for API key
  const providerName = API_KEY_PROVIDER_NAMES[apiKeyName] || apiKeyName;
  const apiKey = await promptForApiKey(apiKeyName);

  if (!apiKey) {
    return false;
  }

  // Save to .env file
  if (saveApiKeyToEnv(apiKeyName, apiKey)) {
    console.log(`\n✓ ${providerName} API key saved to .env file`);
    return true;
  } else {
    console.log(`\n✗ Failed to save ${providerName} API key`);
    return false;
  }
}

