<script lang="ts">
  import type { ConnectionConfig } from '$lib/types';
  import Button from '$lib/components/common/Button.svelte';
  import Input from '$lib/components/common/Input.svelte';
  import Alert from '$lib/components/common/Alert.svelte';
  import { testConnection, createConnection, updateConnection } from '$lib/stores/connection';

  interface Props {
    editing: ConnectionConfig | null;
    onsaved: () => void;
  }

  let { editing = $bindable(), onsaved }: Props = $props();

  let formData = $state<ConnectionConfig>({
    id: crypto.randomUUID(),
    name: '',
    host: '127.0.0.1',
    port: 6379,
    password: undefined,
    password_stored: false,
    username: undefined,
    db: 0,
    ssl: false,
    ssh_tunnel: false,
    ssh_host: undefined,
    ssh_port: undefined,
    ssh_user: undefined,
    cluster: false,
    sentinel: false,
    sentinel_master: undefined,
  });

  let showAlert = $state(false);
  let alertTitle = $state('');
  let alertMessage = $state('');
  let alertType = $state<'info' | 'success' | 'error'>('info');

  $effect(() => {
    if (editing) {
      formData = { ...editing };
    }
  });

  function resetForm() {
    formData = {
      id: crypto.randomUUID(),
      name: '',
      host: '127.0.0.1',
      port: 6379,
      password: undefined,
      password_stored: false,
      username: undefined,
      db: 0,
      ssl: false,
      ssh_tunnel: false,
      ssh_host: undefined,
      ssh_port: undefined,
      ssh_user: undefined,
      cluster: false,
      sentinel: false,
      sentinel_master: undefined,
    };
    editing = null;
  }

  async function handleTest() {
    const latency = await testConnection(formData);
    if (latency !== null) {
      alertTitle = 'success';
      alertMessage = `Connection OK - ${latency}ms`;
      alertType = 'success';
    } else {
      alertTitle = 'error';
      alertMessage = 'Connection failed';
      alertType = 'error';
    }
    showAlert = true;
  }

  async function handleSave() {
    if (editing) {
      await updateConnection(formData);
    } else {
      await createConnection(formData);
    }
    resetForm();
    onsaved();
  }

  function handleAlertClose() {
    showAlert = false;
  }
</script>

<div class="h-10 px-4 border-b border-[var(--color-macos-border)] flex items-center">
  <span class="text-sm text-[var(--color-macos-text-secondary)] font-medium">
    {editing ? 'edit connection' : 'new connection'}
  </span>
</div>
<div class="flex-1 flex items-start justify-center p-4 overflow-y-auto">
  <div class="w-full max-w-sm space-y-3 pt-2">
    <div>
      <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">name</span>
      <Input bind:value={formData.name} placeholder="my-redis" />
    </div>
    
    <div class="grid grid-cols-2 gap-3">
      <div>
        <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">host</span>
        <Input bind:value={formData.host} placeholder="127.0.0.1" />
      </div>
      <div>
        <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">port</span>
        <Input type="number" bind:value={formData.port} />
      </div>
    </div>

    <div>
      <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">username <span class="text-[var(--color-macos-text-tertiary)]">(optional)</span></span>
      <Input bind:value={formData.username} placeholder="default" />
    </div>

    <div>
      <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">password <span class="text-[var(--color-macos-text-tertiary)]">(optional)</span></span>
      <Input type="password" bind:value={formData.password} />
    </div>

    <div>
      <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">database</span>
      <Input type="number" bind:value={formData.db} />
    </div>

    <!-- SSL -->
    <div class="pt-1">
      <label class="flex items-center gap-2 text-sm text-[var(--color-macos-text)] cursor-pointer">
        <input type="checkbox" bind:checked={formData.ssl} class="accent-[var(--color-accent)]" />
        <span class="font-medium">SSL/TLS</span>
      </label>
    </div>

    <!-- SSH Tunnel -->
    <div class="pt-1 border-t border-[var(--color-macos-border)]">
      <label class="flex items-center gap-2 text-sm text-[var(--color-macos-text)] cursor-pointer">
        <input type="checkbox" bind:checked={formData.ssh_tunnel} class="accent-[var(--color-accent)]" />
        <span class="font-medium">SSH Tunnel</span>
      </label>
      {#if formData.ssh_tunnel}
        <div class="mt-2 space-y-2 pl-6">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">SSH Host</span>
              <Input bind:value={formData.ssh_host} placeholder="ssh.example.com" />
            </div>
            <div>
              <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">SSH Port</span>
              <Input type="number" bind:value={formData.ssh_port} placeholder="22" />
            </div>
          </div>
          <div>
            <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">SSH Username</span>
            <Input bind:value={formData.ssh_user} placeholder="root" />
          </div>
        </div>
      {/if}
    </div>

    <!-- Cluster -->
    <div class="pt-1 border-t border-[var(--color-macos-border)]">
      <label class="flex items-center gap-2 text-sm text-[var(--color-macos-text)] cursor-pointer">
        <input type="checkbox" bind:checked={formData.cluster} class="accent-[var(--color-accent)]" />
        <span class="font-medium">Redis Cluster</span>
      </label>
    </div>

    <!-- Sentinel -->
    <div class="pt-1">
      <label class="flex items-center gap-2 text-sm text-[var(--color-macos-text)] cursor-pointer">
        <input type="checkbox" bind:checked={formData.sentinel} class="accent-[var(--color-accent)]" />
        <span class="font-medium">Redis Sentinel</span>
      </label>
      {#if formData.sentinel}
        <div class="mt-2 space-y-2 pl-6">
          <div>
            <span class="block text-xs text-[var(--color-macos-text-secondary)] mb-1">Master Name</span>
            <Input bind:value={formData.sentinel_master} placeholder="mymaster" />
          </div>
        </div>
      {/if}
    </div>

    <div class="pt-3 border-t border-[var(--color-macos-border)]">
      <div class="flex gap-2">
        <Button variant="secondary" size="sm" onclick={handleTest}>test</Button>
        <div class="flex-1"></div>
        {#if editing}
          <Button variant="ghost" size="sm" onclick={resetForm}>cancel</Button>
        {/if}
        <Button variant="primary" size="sm" onclick={handleSave}>save</Button>
      </div>
    </div>
  </div>
</div>

<Alert 
  bind:open={showAlert}
  title={alertTitle}
  message={alertMessage}
  type={alertType}
  onClose={handleAlertClose}
/>
