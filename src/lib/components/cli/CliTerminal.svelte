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

  let suggestions = $state<string[]>([]);
  let showSuggestions = $state(false);

  function updateSuggestions() {
    const upperInput = input.toUpperCase();
    if (input.trim()) {
      suggestions = commonCommands.filter(cmd => cmd.startsWith(upperInput)).slice(0, 5);
      showSuggestions = suggestions.length > 0;
    } else {
      showSuggestions = false;
    }
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
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[#1a1a1a] border border-[#333] rounded-lg w-full max-w-3xl h-[60vh] flex flex-col shadow-2xl">
      <!-- Header -->
      <div class="h-10 px-4 border-b border-[#333] flex items-center justify-between">
        <span class="text-base text-[#9a9a9a] font-mono">redis cli</span>
        <div class="flex items-center gap-2">
          <button 
            class="text-base text-[#6b6b6b] hover:text-[#dc382d] transition-colors"
            onclick={clearHistory}
          >
            clear
          </button>
          <button 
            class="text-[#6b6b6b] hover:text-white transition-colors"
            onclick={handleClose}
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Output -->
      <div id="cli-output" class="flex-1 overflow-y-auto p-4 font-mono text-base">
        {#each history as item}
          <div class="mb-4">
            <div class="flex items-center gap-2 text-[#28c840]">
              <span>&gt;</span>
              <span>{item.command}</span>
            </div>
            <pre class="{item.isError ? 'text-[#dc382d]' : 'text-[#e0e0e0]'} whitespace-pre-wrap mt-1 text-base">{item.result}</pre>
          </div>
        {/each}
        {#if history.length === 0}
          <div class="text-[#6b6b6b] text-base">
            <p>Welcome to Redis CLI</p>
            <p class="mt-1">Type a command and press Enter to execute.</p>
            <p class="mt-1">Use ↑/↓ arrows for command history, Tab for autocomplete.</p>
          </div>
        {/if}
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-[#333] relative">
        {#if showSuggestions}
          <div class="absolute bottom-full left-4 mb-1 bg-[#2a2a2a] border border-[#444] rounded overflow-hidden">
            {#each suggestions as cmd}
              <button 
                class="block w-full px-3 py-1.5 text-left text-base text-[#e0e0e0] hover:bg-[#3a3a3a] font-mono"
                onclick={() => selectSuggestion(cmd)}
              >
                {cmd}
              </button>
            {/each}
          </div>
        {/if}
        <div class="flex items-center gap-2">
          <span class="text-[#28c840] font-mono">&gt;</span>
          <input 
            bind:this={inputEl}
            bind:value={input}
            oninput={handleInput}
            onkeydown={handleKeydown}
            placeholder="Enter command..."
            class="flex-1 bg-transparent text-[#e0e0e0] font-mono text-base focus:outline-none placeholder:text-[#6b6b6b]"
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
