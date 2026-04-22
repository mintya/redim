<script lang="ts">
  import { activeConnectionId } from '$lib/stores/connection';
  import { toast } from '$lib/stores/toast';
  import { scanAllKeys } from '$lib/utils/redis';
  import { keys, loadKeys } from '$lib/stores/database';
  import { invoke } from '@tauri-apps/api/core';
  import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
  import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
  import Button from '$lib/components/common/Button.svelte';
  import Input from '$lib/components/common/Input.svelte';
  import Modal from '$lib/components/common/Modal.svelte';
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

<Modal bind:open title="import / export" size="md" onclose={handleClose}>
  <div class="space-y-3">
    <div>
      <h3 class="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wide mb-1.5">export</h3>
      <div class="space-y-2">
        <div>
          <span class="block text-xs text-[var(--color-text-secondary)] mb-1">pattern</span>
          <Input bind:value={exportPattern} placeholder="*" />
        </div>
        <div>
          <span class="block text-xs text-[var(--color-text-secondary)] mb-1">format</span>
          <div class="ui-segment">
            <button
              class="ui-segment-item {exportFormat === 'json' ? 'ui-segment-item-active' : ''}"
              onclick={() => (exportFormat = 'json')}
            >
              JSON
            </button>
            <button
              class="ui-segment-item {exportFormat === 'csv' ? 'ui-segment-item-active' : ''}"
              onclick={() => (exportFormat = 'csv')}
            >
              CSV
            </button>
          </div>
        </div>
        <Button variant="secondary" size="sm" onclick={handleExport} disabled={exporting}>
          {exporting ? `exporting... (${exportProgress.current}/${exportProgress.total})` : 'export'}
        </Button>
      </div>
    </div>

    <div class="pt-3 border-t border-[var(--color-border)]">
      <h3 class="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wide mb-1.5">import</h3>
      <p class="text-xs text-[var(--color-text-tertiary)] mb-2">Import from JSON file</p>
      <Button variant="secondary" size="sm" onclick={handleImport} disabled={importing}>
        {importing ? 'importing...' : 'select file'}
      </Button>
    </div>
  </div>
</Modal>
