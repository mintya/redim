<script lang="ts">
  import { activeConnectionId } from '$lib/stores/connection';
  import { keys, loadKeys, loadKeyValue, loadKeyInfo } from '$lib/stores/database';
  import { invoke } from '@tauri-apps/api/core';
  import Button from '$lib/components/common/Button.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  let exportFormat = $state<'json' | 'csv'>('json');
  let exportPattern = $state('*');
  let exporting = $state(false);
  let importing = $state(false);
  let status = $state('');
  let error = $state('');

  async function handleExport() {
    if (!$activeConnectionId) return;
    
    exporting = true;
    status = 'Exporting...';
    error = '';

    try {
      // 获取匹配的 keys
      const [, keyList] = await invoke<[number, string[]]>('get_keys', {
        id: $activeConnectionId,
        pattern: exportPattern,
        cursor: 0,
        count: 10000
      });

      const data: Record<string, any> = {};

      for (const key of keyList) {
        const info = await loadKeyInfo($activeConnectionId, key);
        if (info) {
          const value = await loadKeyValue($activeConnectionId, key, info.key_type);
          data[key] = {
            type: info.key_type,
            value: value,
            ttl: info.ttl
          };
        }
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = `redis-export-${Date.now()}.json`;
        mimeType = 'application/json';
      } else {
        // CSV format
        const rows = ['key,type,ttl,value'];
        for (const [key, val] of Object.entries(data)) {
          const valueStr = typeof val.value === 'string' ? val.value : JSON.stringify(val.value);
          rows.push(`"${key}","${val.type}",${val.ttl},"${valueStr.replace(/"/g, '""')}"`);
        }
        content = rows.join('\n');
        filename = `redis-export-${Date.now()}.csv`;
        mimeType = 'text/csv';
      }

      // 下载文件
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      status = `Exported ${keyList.length} keys`;
    } catch (e) {
      error = String(e);
      status = 'Export failed';
    }

    exporting = false;
  }

  async function handleImport() {
    if (!$activeConnectionId) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      importing = true;
      status = 'Importing...';
      error = '';

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        let count = 0;
        for (const [key, val] of Object.entries(data)) {
          const { type, value, ttl } = val as any;

          switch (type) {
            case 'string':
              await invoke('set_string', { id: $activeConnectionId, key, value });
              break;
            case 'hash':
              for (const item of value as any[]) {
                await invoke('set_hash_field', { id: $activeConnectionId, key, field: item.field, value: item.value });
              }
              break;
            case 'list':
              for (const item of value as string[]) {
                await invoke('push_list', { id: $activeConnectionId, key, value: item, atHead: false });
              }
              break;
            case 'set':
              for (const item of value as string[]) {
                await invoke('add_set', { id: $activeConnectionId, key, member: item });
              }
              break;
            case 'zset':
              for (const item of value as any[]) {
                await invoke('add_zset', { id: $activeConnectionId, key, member: item.member, score: item.score });
              }
              break;
          }

          if (ttl > 0) {
            await invoke('set_ttl', { id: $activeConnectionId, key, ttl });
          }

          count++;
        }

        await loadKeys($activeConnectionId);
        status = `Imported ${count} keys`;
      } catch (e) {
        error = String(e);
        status = 'Import failed';
      }

      importing = false;
    };

    input.click();
  }

  function handleClose() {
    open = false;
    status = '';
    error = '';
    onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[#f8f8f8] border border-[#d4d4d4] rounded-lg w-full max-w-md shadow-lg">
      <!-- Header -->
      <div class="h-10 px-4 border-b border-[#d4d4d4] flex items-center justify-between">
        <span class="text-base text-[#1a1a1a] font-mono">import / export</span>
        <button 
          class="text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
          onclick={handleClose}
        >
          ✕
        </button>
      </div>

      <!-- Content -->
      <div class="p-4 space-y-4">
        <!-- Export Section -->
        <div>
          <h3 class="text-base text-[#6b6b6b] mb-2">export</h3>
          <div class="space-y-2">
            <div>
              <span class="block text-base text-[#9a9a9a] mb-1">pattern</span>
              <input 
                type="text" 
                bind:value={exportPattern}
                placeholder="*"
                class="w-full px-2.5 py-1.5 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d]"
              />
            </div>
            <div>
              <span class="block text-base text-[#9a9a9a] mb-1">format</span>
              <div class="flex gap-2">
                <button 
                  class="px-3 py-1.5 text-base font-mono rounded border transition-colors {exportFormat === 'json' ? 'bg-[#dc382d] text-white border-[#dc382d]' : 'bg-[#fafafa] text-[#6b6b6b] border-[#d4d4d4] hover:border-[#dc382d]'}"
                  onclick={() => exportFormat = 'json'}
                >
                  JSON
                </button>
                <button 
                  class="px-3 py-1.5 text-base font-mono rounded border transition-colors {exportFormat === 'csv' ? 'bg-[#dc382d] text-white border-[#dc382d]' : 'bg-[#fafafa] text-[#6b6b6b] border-[#d4d4d4] hover:border-[#dc382d]'}"
                  onclick={() => exportFormat = 'csv'}
                >
                  CSV
                </button>
              </div>
            </div>
            <Button variant="secondary" onclick={handleExport} disabled={exporting}>
              {exporting ? 'exporting...' : 'export'}
            </Button>
          </div>
        </div>

        <!-- Import Section -->
        <div class="pt-4 border-t border-[#d4d4d4]">
          <h3 class="text-base text-[#6b6b6b] mb-2">import</h3>
          <p class="text-base text-[#9a9a9a] mb-2">Import from JSON file</p>
          <Button variant="secondary" onclick={handleImport} disabled={importing}>
            {importing ? 'importing...' : 'select file'}
          </Button>
        </div>

        <!-- Status -->
        {#if status}
          <div class="pt-4 border-t border-[#d4d4d4]">
            <p class="text-base {error ? 'text-[#dc382d]' : 'text-[#28c840]'}">{status}</p>
            {#if error}
              <p class="text-base text-[#dc382d] mt-1">{error}</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
