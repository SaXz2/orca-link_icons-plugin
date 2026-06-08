import { CONFIG } from './libs/config';
import { IconCache } from './libs/cache';
import { fetchIcon } from './libs/icon-fetcher';

type Runtime = {
  cache: IconCache;
  processLinks: () => void;
  cleanup: () => void;
  restoreIcons: () => void;
};

const COMMAND_CLEAR_CACHE = 'orca-link-icons.clearCache';
const COMMAND_REFRESH_CACHE = 'orca-link-icons.refreshCache';

let runtime: Runtime | null = null;
let beforeUnloadCleanup: (() => void) | null = null;

function extractDomain(url: string): string | null {
  const value = url.trim();
  if (!value) return null;

  try {
    const { hostname, protocol } = new URL(
      /^[a-z][a-z\d+\-.]*:/i.test(value) ? value : `https://${value}`,
    );
    if (protocol !== 'http:' && protocol !== 'https:') return null;

    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function injectStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .orca-icon-loading {
      animation: orca-icon-pulse 1.5s infinite;
      opacity: 0.6;
    }
    @keyframes orca-icon-pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.9; }
    }
    .orca-dynamic-icon {
      width: 1em;
      height: 1em;
      display: inline-block;
      vertical-align: text-bottom;
      margin-right: 0.2em;
      object-fit: contain;
      transition: opacity 0.3s;
    }
    .orca-icon-fallback {
      filter: grayscale(80%);
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
  return style;
}

function createDefaultIcon(): HTMLElement {
  const icon = document.createElement('i');
  icon.className = 'ti ti-world orca-inline-l-icon';
  return icon;
}

function getIconNode(linkElement: Element): HTMLElement | null {
  return linkElement.querySelector(
    `${CONFIG.ICON_SELECTOR}, .orca-dynamic-icon`,
  ) as HTMLElement | null;
}

function resetLink(linkElement: Element): void {
  const el = linkElement as HTMLElement;
  const currentIcon = getIconNode(linkElement);

  if (currentIcon?.classList.contains('orca-dynamic-icon')) {
    currentIcon.replaceWith(createDefaultIcon());
  } else {
    currentIcon?.classList.remove('orca-icon-loading');
  }

  delete el.dataset.iconHref;
  delete el.dataset.iconState;
  delete el.dataset.iconProcessed;
}

function start(): Runtime {
  const style = injectStyles();
  const cache = new IconCache(
    CONFIG.CACHE_KEY,
    CONFIG.MAX_CACHE_SIZE,
    CONFIG.MAX_CACHE_STORAGE_CHARS,
    CONFIG.FAILURE_CACHE_TTL,
  );
  const pendingFetches = new Map<string, Promise<string | null>>();
  const batchTimers = new Set<ReturnType<typeof setTimeout>>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  async function getIconUrl(domain: string): Promise<string | null> {
    const cached = cache.get(domain);
    if (cached !== undefined) return cached;

    const pending = pendingFetches.get(domain);
    if (pending) return pending;

    const request = fetchIcon(domain, {
      sources: CONFIG.ICON_SOURCES.map((fn) => fn(domain)),
      timeout: CONFIG.LOAD_TIMEOUT,
      maxRetries: CONFIG.RETRY_COUNT,
      maxBytes: CONFIG.MAX_ICON_BYTES,
    })
      .then((result) => {
        cache.set(domain, result);
        return result;
      })
      .finally(() => pendingFetches.delete(domain));

    pendingFetches.set(domain, request);
    return request;
  }

  async function replaceIcon(linkElement: Element): Promise<void> {
    const el = linkElement as HTMLElement;
    const href = linkElement.getAttribute('href') || '';

    if (el.dataset.iconHref === href && el.dataset.iconState) {
      return;
    }

    const domain = extractDomain(href);
    if (!domain) {
      resetLink(linkElement);
      el.dataset.iconHref = href;
      el.dataset.iconState = 'skipped';
      return;
    }

    const icon = getIconNode(linkElement);
    if (!icon) {
      return;
    }

    el.dataset.iconHref = href;
    el.dataset.iconState = 'pending';
    icon.classList.add('orca-icon-loading');

    try {
      const iconUrl = await getIconUrl(domain);
      if (disposed || el.dataset.iconHref !== href) return;

      icon.classList.remove('orca-icon-loading');

      const img = new Image();
      img.className = iconUrl
        ? 'orca-dynamic-icon'
        : 'orca-dynamic-icon orca-icon-fallback';
      img.alt = `${domain} icon`;
      img.src = iconUrl || CONFIG.FALLBACK_ICON;

      img.onload = () => {
        if (!disposed && el.dataset.iconHref === href) {
          getIconNode(linkElement)?.replaceWith(img);
          img.style.opacity = '1';
          el.dataset.iconState = 'done';
        }
      };

      img.onerror = () => {
        img.onerror = null;
        img.src = CONFIG.FALLBACK_ICON;
        img.className = 'orca-dynamic-icon orca-icon-fallback';
        cache.set(domain, null);
      };
    } catch (error) {
      console.warn(
        `[link-icons] Failed to process link: ${linkElement.getAttribute('href')}`,
        error,
      );
      icon.classList.remove('orca-icon-loading');
      el.dataset.iconState = 'skipped';
    }
  }

  function scheduleDelay(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        batchTimers.delete(timer);
        resolve();
      }, CONFIG.BATCH_INTERVAL);
      batchTimers.add(timer);
    });
  }

  const processLinks = () => {
    if (disposed) return;
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const links = [...document.querySelectorAll(CONFIG.SELECTOR)];

      if (links.length === 0) return;

      for (let i = 0; i < links.length && !disposed; i += CONFIG.BATCH_SIZE) {
        const batch = links.slice(i, i + CONFIG.BATCH_SIZE);
        await Promise.all(batch.map((link) => replaceIcon(link)));

        if (i + CONFIG.BATCH_SIZE < links.length) {
          await scheduleDelay();
        }
      }
    }, CONFIG.DEBOUNCE_DELAY);
  };

  function shouldHandle(e: Event): boolean {
    return !!(e.target as Element).closest?.(
      '[contenteditable], .orca-inline-editor',
    );
  }

  const onPaste = (e: Event) => {
    if (shouldHandle(e)) processLinks();
  };
  const onInput = (e: Event) => {
    if (shouldHandle(e)) processLinks();
  };
  const onDrop = () => processLinks();

  const observer = new MutationObserver((mutations) => {
    if (
      mutations.some((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'href'
        ) {
          return true;
        }

        return [...mutation.addedNodes].some((node) => node.nodeType === 1);
      })
    ) {
      processLinks();
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  document.addEventListener('paste', onPaste);
  document.addEventListener('input', onInput);
  document.addEventListener('drop', onDrop);

  processLinks();

  const restoreIcons = () => {
    document.querySelectorAll(CONFIG.SELECTOR).forEach(resetLink);
  };

  const cleanup = () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('input', onInput);
    document.removeEventListener('drop', onDrop);

    if (debounceTimer) clearTimeout(debounceTimer);
    batchTimers.forEach((timer) => clearTimeout(timer));
    batchTimers.clear();

    restoreIcons();
    style.remove();
  };

  console.log('[link-icons] started');

  return {
    cache,
    processLinks,
    cleanup,
    restoreIcons,
  };
}

export async function load(pluginName: string) {
  if (beforeUnloadCleanup) {
    window.removeEventListener('beforeunload', beforeUnloadCleanup);
    beforeUnloadCleanup = null;
  }

  runtime?.cleanup();
  runtime = start();

  function clearRuntimeCache(refresh: boolean): void {
    if (!runtime) return;

    runtime.cache.clear();
    CONFIG.LEGACY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    runtime.restoreIcons();

    if (refresh) {
      runtime.processLinks();
    }
  }

  orca.commands.registerCommand(
    COMMAND_CLEAR_CACHE,
    () => {
      clearRuntimeCache(false);
      orca.notify('success', '链接图标缓存已清除');
    },
    '清除链接图标缓存',
  );

  orca.commands.registerCommand(
    COMMAND_REFRESH_CACHE,
    () => {
      clearRuntimeCache(true);
      orca.notify('success', '链接图标缓存已清除，正在重新获取');
    },
    '刷新链接图标缓存',
  );

  (window as any).__ORCA_ICON_REPLACER = {
    restart() {
      runtime?.cleanup();
      runtime = start();
      console.log('[link-icons] restarted');
    },

    stop() {
      runtime?.cleanup();
      runtime = null;
      console.log('[link-icons] stopped');
    },

    clearCache() {
      clearRuntimeCache(true);
      console.log('[link-icons] cache cleared');
    },

    getStats() {
      return {
        cachedIcons: runtime?.cache.size ?? 0,
        lastUpdated: new Date().toLocaleString(),
        running: runtime !== null,
        config: { ...CONFIG, ICON_SOURCES: '<functions>' },
      };
    },

    inspectMemory() {
      const mem = (performance as any)?.memory;
      return mem
        ? {
            usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
            totalMB: Math.round(mem.totalJSHeapSize / 1024 / 1024),
            ratio:
              Math.round(
                (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100,
              ) + '%',
          }
        : 'Memory API is unavailable';
    },
  };

  beforeUnloadCleanup = () => {
    runtime?.cleanup();
    runtime = null;
    delete (window as any).__ORCA_ICON_REPLACER;
  };
  window.addEventListener('beforeunload', beforeUnloadCleanup, { once: true });

  console.log(`${pluginName} loaded.`);
}

export async function unload() {
  if (beforeUnloadCleanup) {
    window.removeEventListener('beforeunload', beforeUnloadCleanup);
    beforeUnloadCleanup = null;
  }

  runtime?.cleanup();
  runtime = null;

  orca.commands.unregisterCommand(COMMAND_CLEAR_CACHE);
  orca.commands.unregisterCommand(COMMAND_REFRESH_CACHE);

  if ((window as any).__ORCA_ICON_REPLACER) {
    delete (window as any).__ORCA_ICON_REPLACER;
  }
  console.log('[link-icons] unloaded');
}
