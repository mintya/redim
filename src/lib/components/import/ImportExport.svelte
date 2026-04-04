<script lang="ts">
  import { activeConnectionId } from '$lib/stores/connection';
  import { toast } from '$lib/stores/toast';
  import { scanAllKeys } from '$lib/utils/redis';
  import { keys, loadKeys } from '$lib/stores/database';
  import { invoke } from '@tauri-apps/api/core';
  import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
  import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
  import Button from '$lib/components/common/Button.svelte';
  import type { KeyInfo, HashField, ZSetMember } from '$lib/types';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  let exportFormat = $state<'json' | 'csv'>('json');
  let exportPattern = $state('*');
  let exporting = $state(false);
  let importing = $state(false);
  let exportProgress = $state({ current: 0, total: 0 });

  // 直接从Redis获取key信息，不更新全局store
  async function fetchKeyInfo(connectionId: string, key: string): Promise<KeyInfo | null> {
    try {
      return await invoke<KeyInfo>('get_key_info', { id: connectionId, key });
    } catch {
      return null;
    }
  }

  // 直接从Redis获取key值，不更新全局store
  async function fetchKeyValue(connectionId: string, key: string, keyType: string): Promise<any> {
    try {
      switch (keyType) {
        case 'string':
          return await invoke<string>('get_string', { id: connectionId, key });
        case 'hash':
          return await invoke<HashField[]>('get_hash', { id: connectionId, key });
        case 'list':
          return await invoke<string[]>('get_list', { id: connectionId, key });
        case 'set':
          return await invoke<string[]>('get_set', { id: connectionId, key });
        case 'zset':
          return await invoke<ZSetMember[]>('get_zset', { id: connectionId, key });
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  async function handleExport() {
    if (!$activeConnectionId) return;

    exporting = true;

    try {
      const keyList = await scanAllKeys($activeConnectionId, exportPattern, 5000);
      const data: Record<string, any> = {};
      exportProgress = { current: 0, total: keyList.length };

      for (const key of keyList) {
        const info = await fetchKeyInfo($activeConnectionId, key);
        if (info) {
          const value = await fetchKeyValue($activeConnectionId, key, info.key_type);
          data[key] = {
            type: info.key_type,
            value: value,
            ttl: info.ttl
          };
        }
        exportProgress.current++;
      }

      let content: string;
      let filename: string;

      if (exportFormat === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = `redis-export-${Date.now()}.json`;
      } else {
        // CSV format
        const rows = ['key,type,ttl,value'];
        for (const [key, val] of Object.entries(data)) {
          const valueStr = typeof val.value === 'string' ? val.value : JSON.stringify(val.value);
          rows.push(`"${key}","${val.type}",${val.ttl},"${valueStr.replace(/"/g, '""')}"`);
        }
        content = rows.join('\n');
        filename = `redis-export-${Date.now()}.csv`;
      }

      // Use Tauri save dialog
      const filePath = await save({
        defaultPath: filename,
        filters: [{ name: exportFormat.toUpperCase(), extensions: [exportFormat] }]
      });

      if (filePath) {
        await writeTextFile(filePath, content);
        toast.success(`Exported ${keyList.length} keys to ${filePath}`);
        handleClose();
      }
    } catch (e) {
      toast.error(`Export failed: ${String(e)}`);
    }

    exporting = false;
    exportProgress = { current: 0, total: 0 };
  }

  async function handleImport() {
    if (!$activeConnectionId) return;

    // Use Tauri open dialog
    const filePath = await openDialog({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (!filePath) return;

    importing = true;

    try {
      const text = await readTextFile(filePath as string);
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
      toast.success(`Imported ${count} keys`);
      handleClose();
    } catch (e) {
      toast.error(`Import failed: ${String(e)}`);
    }

    importing = false;
  }

  function handleClose() {
    open = false;
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
    <div class="bg-[var(--color-surface-input)] border border-[var(--color-border-divider)] rounded-lg w-full max-w-md shadow-lg">
      <!-- Header -->
      <div class="h-10 px-4 border-b border-[var(--color-border-divider)] flex items-center justify-between">
        <span class="text-base text-[var(--color-info-text)] font-mono">import / export</span>
        <button
          class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)] transition-colors"
          onclick={handleClose}
        >
          ✕
        </button>
      </div>

      <!-- Content -->
      <div class="p-3 space-y-3">
        <!-- Export Section -->
        <div>
          <h3 class="text-base text-[var(--color-text-muted)] mb-1">export</h3>
          <div class="space-y-2">
            <div>
              <span class="block text-sm text-[var(--color-text-faint)] mb-1">pattern</span>
              <input
                type="text"
                bind:value={exportPattern}
                placeholder="*"
                class="w-full px-2.5 py-1.5 bg-[var(--color-surface-input)] border border-[var(--color-border-divider)] rounded text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <span class="block text-sm text-[var(--color-text-faint)] mb-1">format</span>
              <div class="flex gap-2">
                <button
                  class="px-3 py-1.5 text-sm font-mono rounded border transition-colors {exportFormat === 'json' ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'bg-[var(--color-surface-input)] text-[var(--color-text-muted)] border-[var(--color-border-divider)] hover:border-[var(--color-accent)]'}"
                  onclick={() => exportFormat = 'json'}
                >
                  JSON
                </button>
                <button
                  class="px-3 py-1.5 text-sm font-mono rounded border transition-colors {exportFormat === 'csv' ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'bg-[var(--color-surface-input)] text-[var(--color-text-muted)] border-[var(--color-border-divider)] hover:border-[var(--color-accent)]'}"
                  onclick={() => exportFormat = 'csv'}
                >
                  CSV
                </button>
              </div>
            </div>
            <Button variant="secondary" onclick={handleExport} disabled={exporting}>
              {exporting ? `exporting... (${exportProgress.current}/${exportProgress.total})` : 'export'}
            </Button>
          </div>
        </div>

        <!-- Import Section -->
        <div class="pt-3 border-t border-[var(--color-border-divider)]">
          <h3 class="text-base text-[var(--color-text-muted)] mb-1">import</h3>
          <p class="text-sm text-[var(--color-text-faint)] mb-1">Import from JSON file</p>
          <Button variant="secondary" onclick={handleImport} disabled={importing}>
            {importing ? 'importing...' : 'select file'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
