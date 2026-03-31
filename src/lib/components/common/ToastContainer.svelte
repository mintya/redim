<script lang="ts">
  import { toasts, removeToast } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
</script>

{#if $toasts.length > 0}
  <div class="fixed top-12 right-4 z-[100] flex flex-col gap-2 max-w-sm">
    {#each $toasts as toast (toast.id)}
      <div
        class="px-4 py-3 rounded shadow-lg border flex items-start gap-2 font-mono text-base"
        class:bg-[#fdf0ef]={toast.type === 'error'}
        class:border-[#dc382d]={toast.type === 'error'}
        class:text-[#dc382d]={toast.type === 'error'}
        class:bg-[#eef9ee]={toast.type === 'success'}
        class:border-[#28c840]={toast.type === 'success'}
        class:text-[#1a8c2e]={toast.type === 'success'}
        class:bg-[#fff8e6]={toast.type === 'warning'}
        class:border-[#ff9f43]={toast.type === 'warning'}
        class:text-[#b36b00]={toast.type === 'warning'}
        class:bg-[#f0f0f0]={toast.type === 'info'}
        class:border-[#d4d4d4]={toast.type === 'info'}
        class:text-[#1a1a1a]={toast.type === 'info'}
        transition:fly={{ x: 200, duration: 200 }}
      >
        <span class="flex-1">{toast.message}</span>
        <button
          class="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
          onclick={() => removeToast(toast.id)}
        >
          ✕
        </button>
      </div>
    {/each}
  </div>
{/if}
