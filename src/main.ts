import { CONFIG } from './libs/config';
import { IconCache } from './libs/cache';
import { fetchIcon } from './libs/icon-fetcher';

let cleanup: (() => void) | null = null;

function extractDomain(url: string): string | null {
  try {
    const { hostname } = new URL(
      url.startsWith('http') ? url : `https://${url}`,
    );
    return hostname.replace(/^www\./, '');
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

export async function load(pluginName: string) {
  let activeCleanup: (() => void) | null = null;
  let cache: IconCache;
  let processLinks: () => void;
  let style: HTMLStyleElement;

  function start(): () => void {
    style = injectStyles();
    cache = new IconCache(CONFIG.CACHE_KEY, CONFIG.MAX_CACHE_SIZE);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const batchTimers: ReturnType<typeof setTimeout>[] = [];

    async function replaceIcon(linkElement: Element): Promise<void> {
      const originalIcon = linkElement.querySelector(
        CONFIG.ICON_SELECTOR,
      ) as HTMLElement | null;
      if (!originalIcon) return;

      const el = linkElement as HTMLElement;
      if (el.dataset.iconProcessed) return;
      el.dataset.iconProcessed = 'true';

      originalIcon.classList.add('orca-icon-loading');

      try {
        const url = linkElement.getAttribute('href') || '';
        const domain = extractDomain(url);
        if (!domain) return;

        let iconUrl = cache.get(domain);
        if (iconUrl === undefined) {
          const fetched = await fetchIcon(domain, {
            sources: CONFIG.ICON_SOURCES.map((fn) => fn(domain)),
            timeout: CONFIG.LOAD_TIMEOUT,
            maxRetries: CONFIG.RETRY_COUNT,
          });
          if (fetched) {
            cache.set(domain, fetched);
            iconUrl = fetched;
          }
        }

        originalIcon.classList.remove('orca-icon-loading');

        const img = new Image();
        img.className = iconUrl
          ? 'orca-dynamic-icon'
          : 'orca-dynamic-icon orca-icon-fallback';
        img.src = iconUrl || CONFIG.FALLBACK_ICON;
        img.alt = `${domain} icon`;

        img.onload = () => {
          originalIcon.replaceWith(img);
          img.style.opacity = '1';
        };

        img.onerror = () => {
          img.src = CONFIG.FALLBACK_ICON;
          img.className = 'orca-dynamic-icon orca-icon-fallback';
        };
      } catch (e) {
        console.warn(
          `[图标插件] 处理链接失败: ${linkElement.getAttribute('href')}`,
          e,
        );
        originalIcon.classList.remove('orca-icon-loading');
      }
    }

    processLinks = () => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        const links = [
          ...document.querySelectorAll(
            `${CONFIG.SELECTOR}:not([data-icon-processed])`,
          ),
        ];

        if (links.length === 0) return;

        for (let i = 0; i < links.length; i += CONFIG.BATCH_SIZE) {
          const batch = links.slice(i, i + CONFIG.BATCH_SIZE);
          await Promise.all(batch.map((link) => replaceIcon(link)));

          if (i + CONFIG.BATCH_SIZE < links.length) {
            await new Promise<void>((r) => {
              const timer = setTimeout(r, CONFIG.BATCH_INTERVAL);
              batchTimers.push(timer);
            });
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
        mutations.some((m) =>
          [...m.addedNodes].some((n) => n.nodeType === 1),
        )
      ) {
        processLinks();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('paste', onPaste);
    document.addEventListener('input', onInput);
    document.addEventListener('drop', onDrop);

    processLinks();

    console.log('[图标插件] 已启动');

    return () => {
      observer.disconnect();
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('input', onInput);
      document.removeEventListener('drop', onDrop);

      if (debounceTimer) clearTimeout(debounceTimer);
      batchTimers.forEach((t) => clearTimeout(t));

      if (style.parentNode) style.remove();

      console.log('[图标插件] 已卸载');
    };
  }

  activeCleanup = start();

  (window as any).__ORCA_ICON_REPLACER = {
    restart() {
      activeCleanup?.();
      activeCleanup = start();
      console.log('[图标插件] 已重启');
    },

    stop() {
      activeCleanup?.();
      activeCleanup = null;
      console.log('[图标插件] 已停止');
    },

    clearCache() {
      cache.clear();
      document.querySelectorAll('.orca-dynamic-icon').forEach((icon) => {
        icon.remove();
        const inline = icon.closest('.orca-inline') as HTMLElement;
        if (inline) delete inline.dataset.iconProcessed;
      });
      console.log('[图标插件] 已清除缓存');
      processLinks();
    },

    getStats() {
      return {
        cachedIcons: cache.size,
        lastUpdated: new Date().toLocaleString(),
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
        : 'Memory API 不可用';
    },
  };

  window.addEventListener('beforeunload', () => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    delete (window as any).__ORCA_ICON_REPLACER;
  });

  cleanup = () => activeCleanup?.();

  console.log(`${pluginName} loaded.`);
}

export async function unload() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  if ((window as any).__ORCA_ICON_REPLACER) {
    delete (window as any).__ORCA_ICON_REPLACER;
  }
  console.log('[图标插件] 已卸载');
}
