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

<div class="h-11 px-4 border-b border-[#d4d4d4] flex items-center">
  <span class="text-base text-[#6b6b6b] font-mono">
    {editing ? 'edit connection' : 'new connection'}
  </span>
</div>
<div class="flex-1 flex items-start justify-center p-6 overflow-y-auto">
  <div class="w-full max-w-sm space-y-4 pt-4">
    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">name</span>
      <Input bind:value={formData.name} placeholder="my-redis" />
    </div>
    
    <div class="grid grid-cols-2 gap-4">
      <div>
        <span class="block text-base text-[#6b6b6b] mb-2">host</span>
        <Input bind:value={formData.host} placeholder="127.0.0.1" />
      </div>
      <div>
        <span class="block text-base text-[#6b6b6b] mb-2">port</span>
        <Input type="number" bind:value={formData.port} />
      </div>
    </div>

    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">username <span class="text-[#9a9a9a]">(optional)</span></span>
      <Input bind:value={formData.username!} placeholder="default" />
    </div>

    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">password <span class="text-[#9a9a9a]">(optional)</span></span>
      <Input type="password" bind:value={formData.password!} />
    </div>

    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">database</span>
      <Input type="number" bind:value={formData.db} />
    </div>

    <div class="flex gap-6 pt-2">
      <label class="flex items-center gap-2 text-base text-[#6b6b6b] cursor-pointer">
        <input type="checkbox" bind:checked={formData.ssl} class="accent-[#dc382d]" />
        ssl
      </label>
      <label class="flex items-center gap-2 text-base text-[#6b6b6b] cursor-pointer">
        <input type="checkbox" bind:checked={formData.cluster} class="accent-[#dc382d]" />
        cluster
      </label>
      <label class="flex items-center gap-2 text-base text-[#6b6b6b] cursor-pointer">
        <input type="checkbox" bind:checked={formData.sentinel} class="accent-[#dc382d]" />
        sentinel
      </label>
    </div>

    <div class="pt-4 border-t border-[#d4d4d4]">
      <div class="flex gap-2">
        <Button variant="secondary" onclick={handleTest}>test</Button>
        <div class="flex-1"></div>
        {#if editing}
          <Button variant="ghost" onclick={resetForm}>cancel</Button>
        {/if}
        <Button variant="primary" onclick={handleSave}>save</Button>
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
