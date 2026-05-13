import type { Action } from 'svelte/action';

export const portal: Action<HTMLElement, HTMLElement | string | undefined> = (node, target) => {
  function resolveTarget(value: HTMLElement | string | undefined): HTMLElement {
    if (!value) return document.body;
    if (typeof value === 'string') {
      const found = document.querySelector(value);
      if (found instanceof HTMLElement) return found;
      return document.body;
    }
    return value;
  }

  let host = resolveTarget(target);
  host.appendChild(node);

  return {
    update(next) {
      const nextHost = resolveTarget(next);
      if (nextHost !== host) {
        host = nextHost;
        host.appendChild(node);
      }
    },
    destroy() {
      node.parentNode?.removeChild(node);
    },
  };
};
