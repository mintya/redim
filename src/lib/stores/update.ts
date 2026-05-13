import { writable } from 'svelte/store';
import type { Update } from '@tauri-apps/plugin-updater';

export interface UpdateState {
  available: boolean;
  version: string | null;
  update: Update | null;
}

export const updateState = writable<UpdateState>({
  available: false,
  version: null,
  update: null,
});

export async function setAvailableUpdate(update: Update | null) {
  updateState.update((prev) => {
    if (prev.update && prev.update !== update) {
      void prev.update.close();
    }
    return update
      ? { available: true, version: update.version, update }
      : { available: false, version: null, update: null };
  });
}
