<script lang="ts">
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';
  import Button from '$lib/components/common/Button.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  interface HistoryItem {
    command: string;
    result: string;
    isError: boolean;
  }

  let input = $state('');
  let history = $state<HistoryItem[]>([]);
  let commandHistory = $state<string[]>([]);
  let historyIndex = $state(-1);
  let inputEl = $state<HTMLInputElement | null>(null);
  let showDangerConfirm = $state(false);
  let pendingDangerousCmd = $state('');

  const dangerousCommands = ['FLUSHDB', 'FLUSHALL', 'SHUTDOWN', 'DEBUG', 'CONFIG SET'];

  function isDangerousCommand(cmd: string): boolean {
    const upper = cmd.trim().toUpperCase();
    return dangerousCommands.some(d => upper.startsWith(d));
  }

  const commonCommands = [
    'GET', 'SET', 'DEL', 'EXISTS', 'EXPIRE', 'TTL', 'TYPE', 'KEYS', 'SCAN',
    'HGET', 'HSET', 'HGETALL', 'HDEL', 'HLEN',
    'LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LRANGE', 'LLEN',
    'SADD', 'SREM', 'SMEMBERS', 'SCARD',
    'ZADD', 'ZREM', 'ZRANGE', 'ZSCORE', 'ZCARD',
    'INCR', 'DECR', 'APPEND', 'STRLEN',
    'PING', 'SELECT', 'INFO', 'DBSIZE', 'FLUSHDB', 'FLUSHALL'
  ];

  const PARAM_SUGGESTIONS: Record<string, string[]> = {
    'SET': ['EX', 'PX', 'NX', 'XX', 'KEEPTTL', 'GET'],
    'GET': [],
    'HSET': [],
    'HGET': [],
    'HGETALL': [],
    'LPUSH': [],
    'RPUSH': [],
    'LPOP': [],
    'RPOP': [],
    'LRANGE': ['0', '-1'],
    'SADD': [],
    'SMEMBERS': [],
    'ZADD': ['NX', 'XX', 'CH', 'INCR'],
    'ZRANGE': ['0', '-1', 'WITHSCORES'],
    'EXPIRE': [],
    'TTL': [],
    'CONFIG': ['GET', 'SET', 'RESETSTAT', 'REWRITE'],
  };

  let suggestions = $state<string[]>([]);
  let showSuggestions = $state(false);

  function updateSuggestions() {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1 && trimmed) {
      const upperInput = parts[0].toUpperCase();
      suggestions = commonCommands.filter(cmd => cmd.startsWith(upperInput)).slice(0, 5);
      showSuggestions = suggestions.length > 0;
    } else if (parts.length >= 2) {
      const cmd = parts[0].toUpperCase();
      const partial = parts[parts.length - 1].toUpperCase();
      const paramSuggestions = getParamSuggestions(cmd, partial);
      suggestions = paramSuggestions;
      showSuggestions = suggestions.length > 0;
    } else {
      showSuggestions = false;
    }
  }

  function getParamSuggestions(cmd: string, partial: string): string[] {
    const cmdParams = PARAM_SUGGESTIONS[cmd] || [];
    if (!partial) return cmdParams.slice(0, 5);
    return cmdParams.filter(p => p.toUpperCase().startsWith(partial)).slice(0, 5);
  }

  async function execute() {
    const cmd = input.trim();
    if (!cmd || !$activeConnectionId) return;

    if (isDangerousCommand(cmd)) {
      pendingDangerousCmd = cmd;
      showDangerConfirm = true;
      return;
    }

    await executeCommand(cmd);
  }

  async function executeCommand(cmd: string) {
    if (!$activeConnectionId) return;

    const args = cmd.split(/\s+/);
    commandHistory.unshift(cmd);
    if (commandHistory.length > 100) {
      commandHistory = commandHistory.slice(0, 100);
    }
    historyIndex = -1;
    input = '';
    showSuggestions = false;

    try {
      const result = await invoke<string>('execute_command', { 
        id: $activeConnectionId, 
        args 
      });
      history.push({ command: cmd, result, isError: false });
    } catch (e) {
      history.push({ command: cmd, result: String(e), isError: true });
    }

    if (history.length > 500) {
      history = history.slice(-500);
    }

    // 滚动到底部
    setTimeout(() => {
      const container = document.getElementById('cli-output');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  function handleDangerConfirm() {
    if (pendingDangerousCmd) {
      // Add UNBLOCK prefix for dangerous commands
      executeCommand(`UNBLOCK ${pendingDangerousCmd}`);
      pendingDangerousCmd = '';
    }
    showDangerConfirm = false;
  }

  function handleDangerCancel() {
    pendingDangerousCmd = '';
    showDangerConfirm = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      execute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        historyIndex++;
        input = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input = commandHistory[historyIndex];
      } else if (historyIndex === 0) {
        historyIndex = -1;
        input = '';
      }
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      input = suggestions[0] + ' ';
      showSuggestions = false;
    } else if (e.key === 'Escape') {
      showSuggestions = false;
    }
  }

  function handleInput() {
    updateSuggestions();
    historyIndex = -1;
  }

  function selectSuggestion(cmd: string) {
    input = cmd + ' ';
    showSuggestions = false;
    inputEl?.focus();
  }

  function clearHistory() {
    history = [];
  }

  function handleClose() {
    open = false;
    onclose();
  }

  $effect(() => {
    if (open && inputEl) {
      inputEl.focus();
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-[var(--color-text-primary)]/5 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[var(--color-cli-bg)] border border-[var(--color-cli-border)] rounded-lg w-full max-w-3xl h-[60vh] flex flex-col shadow-[var(--shadow-md)]">
      <!-- Header -->
        <div class="h-10 px-4 border-b border-[var(--color-cli-border)] flex items-center justify-between">
        <span class="text-xs text-[var(--color-cli-text-dim)] font-mono uppercase tracking-wide">redis cli</span>
        <div class="flex items-center gap-2">
          <button 
            class="text-xs text-[var(--color-cli-text-dim)] hover:text-[var(--color-cli-accent)] transition-colors"
            onclick={clearHistory}
          >
            clear
          </button>
          <button 
            class="text-[var(--color-cli-text-dim)] hover:text-white transition-colors"
            onclick={handleClose}
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Output -->
      <div id="cli-output" class="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {#each history as item}
          <div class="mb-4">
            <div class="flex items-center gap-2 text-[var(--color-cli-accent)]">
              <span>&gt;</span>
              <span>{item.command}</span>
            </div>
            <pre class="{item.isError ? 'text-[var(--color-accent)]' : 'text-[var(--color-cli-text)]'} whitespace-pre-wrap mt-1 text-sm">{item.result}</pre>
          </div>
        {/each}
        {#if history.length === 0}
          <div class="text-[var(--color-cli-text-dim)] text-sm">
            <p>Welcome to Redis CLI</p>
            <p class="mt-1">Type a command and press Enter to execute.</p>
            <p class="mt-1">Use ↑/↓ arrows for command history, Tab for autocomplete.</p>
          </div>
        {/if}
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-[var(--color-cli-border)] relative">
        {#if showSuggestions}
          <div class="absolute bottom-full left-4 mb-1 bg-[var(--color-cli-surface)] border border-[var(--color-cli-border)] rounded-md overflow-hidden">
            {#each suggestions as cmd}
              <button 
                class="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-cli-text)] hover:bg-[var(--color-cli-border)] font-mono"
                onclick={() => selectSuggestion(cmd)}
              >
                {cmd}
              </button>
            {/each}
          </div>
        {/if}
        <div class="flex items-center gap-2">
          <span class="text-[var(--color-cli-accent)] font-mono">&gt;</span>
          <input 
            bind:this={inputEl}
            bind:value={input}
            oninput={handleInput}
            onkeydown={handleKeydown}
            placeholder="Enter command..."
            class="flex-1 bg-transparent text-[var(--color-cli-text)] font-mono text-sm focus:outline-none placeholder:text-[var(--color-cli-text-dim)]"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
      </div>
    </div>
  </div>

  <Confirm
    bind:open={showDangerConfirm}
    title="Dangerous Command"
    message={`Are you sure you want to execute "${pendingDangerousCmd}"? This operation may permanently delete data.`}
    confirmText="Execute"
    danger={true}
    onconfirm={handleDangerConfirm}
    oncancel={handleDangerCancel}
  />
{/if}
