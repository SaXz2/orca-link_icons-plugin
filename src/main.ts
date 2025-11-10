import { setupL10N, t } from "./libs/l10n";
import zhCN from "./translations/zhCN";

let cleanup: (() => void) | null = null;

export async function load(pluginName: string) {
  setupL10N(orca.state.locale, { "zh-CN": zhCN });

  // 配置参数
  const CONFIG = {
    CACHE_KEY: 'orca-icon-cache-v3',
    MAX_CACHE_SIZE: 500,
    BATCH_SIZE: 15,
    LOAD_TIMEOUT: 3000,
    RETRY_COUNT: 3,
    FALLBACK_ICON: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMnptLTEgMTVoLTJ2LTJoMnYyem0wLTEzaC0ydjZoMnYtNnoiIGZpbGw9IiM2NjYiLz48L3N2Zz4=',
    DEBOUNCE_DELAY: 500
  };

  // 存储所有需要清理的资源引用
  const resources = {
    observers: [] as MutationObserver[],
    listeners: [] as { type: string; handler: EventListener }[],
    images: new Set<HTMLImageElement>(),
    timeouts: new Set<number>(),
    nodes: [] as Node[]
  };

  // 样式注入
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
  resources.nodes.push(style);

  // 缓存系统
  const cache: Record<string, { url: string; timestamp: number }> = (() => {
    try {
      const saved = localStorage.getItem(CONFIG.CACHE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })();

  const saveCache = () => {
    try {
      const entries = Object.entries(cache);
      if (entries.length > CONFIG.MAX_CACHE_SIZE) {
        const keys = Object.keys(cache)
          .sort((a, b) => cache[b].timestamp - cache[a].timestamp)
          .slice(0, CONFIG.MAX_CACHE_SIZE);
        const newCache: Record<string, { url: string; timestamp: number }> = {};
        keys.forEach(key => { newCache[key] = cache[key]; });
        Object.assign(cache, newCache);
      }
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('[图标插件] 缓存保存失败', e);
    }
  };

  // 核心功能
  const extractDomain = (url: string): string | null => {
    try {
      const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`);
      return hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  const fetchIcon = async (domain: string, retry: number = CONFIG.RETRY_COUNT): Promise<string | null> => {
    const sources = [
      `https://${domain}/favicon.ico`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://favicon.yandex.net/favicon/${domain}`
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.LOAD_TIMEOUT);
    resources.timeouts.add(timeout);

    try {
      const requests = sources.map(source =>
        fetch(source, {
          signal: controller.signal,
          mode: 'no-cors',
          credentials: 'omit'
        })
        .then(res => {
          if (!res.ok) throw new Error('Invalid response');
          return source;
        })
        .catch(() => null)
      );

      for (const request of requests) {
        const result = await request;
        if (result) return result;
      }
      throw new Error('所有图标源均失败');
    } catch (err) {
      if (retry > 0) {
        return fetchIcon(domain, retry - 1);
      }
      return null;
    } finally {
      clearTimeout(timeout);
      resources.timeouts.delete(timeout);
    }
  };

  const replaceIcon = async (linkElement: Element) => {
    const originalIcon = linkElement.querySelector('.ti.ti-world.orca-inline-l-icon') as HTMLElement;
    if (!originalIcon || (linkElement as HTMLElement).dataset.iconProcessed) return;

    (linkElement as HTMLElement).dataset.iconProcessed = 'true';
    originalIcon.classList.add('orca-icon-loading');

    try {
      const url = linkElement.getAttribute('href') || '';
      const domain = extractDomain(url);
      if (!domain) return;

      let iconUrl: string | null = cache[domain]?.url;
      if (!iconUrl) {
        iconUrl = await fetchIcon(domain);
        if (iconUrl) {
          cache[domain] = { url: iconUrl, timestamp: Date.now() };
          saveCache();
        }
      }

      const img = new Image();
      resources.images.add(img);

      const cleanupImage = () => {
        img.onload = img.onerror = null;
        img.src = '';
        resources.images.delete(img);
      };

      img.className = iconUrl ? 'orca-dynamic-icon' : 'orca-dynamic-icon orca-icon-fallback';
      img.src = iconUrl || CONFIG.FALLBACK_ICON;
      img.alt = `${domain} icon`;

      img.onload = () => {
        originalIcon.replaceWith(img);
        img.style.opacity = '1';
        resources.nodes.push(img);
      };

      img.onerror = () => {
        img.src = CONFIG.FALLBACK_ICON;
        img.className = 'orca-dynamic-icon orca-icon-fallback';
        cleanupImage();
      };
    } catch (e) {
      console.warn(`[图标插件] 处理链接失败: ${linkElement.getAttribute('href')}`, e);
    } finally {
      originalIcon.classList.remove('orca-icon-loading');
    }
  };

  // 批量处理器
  const processLinks = (() => {
    let debounceTimer: number;

    const processor = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const links = [...document.querySelectorAll('.orca-inline[data-type="l"]:not([data-icon-processed])')];
        console.log(`[图标插件] 处理 ${links.length} 个新链接`);

        for (let i = 0; i < links.length; i += CONFIG.BATCH_SIZE) {
          const batch = links.slice(i, i + CONFIG.BATCH_SIZE);
          await Promise.all(batch.map(link => replaceIcon(link)));
          await new Promise(r => {
            const timer = setTimeout(r, 100);
            resources.timeouts.add(timer);
          });
        }
      }, CONFIG.DEBOUNCE_DELAY);
      resources.timeouts.add(debounceTimer);
    };

    return processor;
  })();

  // 事件监听
  const handlePaste = (e: Event) => {
    if ((e.target as Element).closest('[contenteditable], .orca-inline-editor')) {
      processLinks();
    }
  };

  const handleInput = (e: Event) => {
    if ((e.target as Element).closest('[contenteditable], .orca-inline-editor')) {
      processLinks();
    }
  };

  // 启动插件
  const init = () => {
    // DOM观察器
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) {
        processLinks();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    resources.observers.push(observer);

    // 事件监听
    const addListener = (type: string, handler: EventListener) => {
      document.addEventListener(type, handler);
      resources.listeners.push({ type, handler });
    };

    addListener('paste', handlePaste);
    addListener('input', handleInput);
    addListener('drop', processLinks);

    // 初始处理
    processLinks();
    console.log('[图标插件] 已启动 (支持实时检测)');

    return () => {
      // 清理所有资源
      resources.observers.forEach(o => o.disconnect());
      resources.listeners.forEach(({ type, handler }) =>
        document.removeEventListener(type, handler)
      );
      resources.timeouts.forEach(t => clearTimeout(t));
      resources.images.forEach(img => {
        img.onload = img.onerror = null;
        img.src = '';
      });
      resources.nodes?.forEach(node => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });

      console.log('[图标插件] 已完全卸载');
    };
  };

  // 控制台命令
  cleanup = init();
  (window as any).__ORCA_ICON_REPLACER = {
    restart: () => {
      if (cleanup) cleanup();
      cleanup = init();
      console.log('[图标插件] 已重启');
    },
    stop: () => {
      if (cleanup) cleanup();
      console.log('[图标插件] 已停止');
    },
    clearCache: () => {
      Object.keys(cache).forEach(key => delete cache[key]);
      localStorage.removeItem(CONFIG.CACHE_KEY);
      console.log('[图标插件] 已清除缓存');
      document.querySelectorAll('.orca-dynamic-icon').forEach(icon => {
        icon.remove();
        delete (icon.closest('.orca-inline') as HTMLElement)?.dataset.iconProcessed;
      });
      processLinks();
    },
    getStats: () => ({
      cachedIcons: Object.keys(cache).length,
      lastUpdated: new Date().toLocaleString(),
      config: CONFIG,
      resourceCounts: {
        observers: resources.observers.length,
        listeners: resources.listeners.length,
        images: resources.images.size,
        timeouts: resources.timeouts.size
      }
    }),
    // 新增内存检查方法
    inspectMemory: () => {
      const mem = (performance as any)?.memory;
      return mem ? {
        usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(mem.totalJSHeapSize / 1024 / 1024),
        ratio: Math.round(mem.usedJSHeapSize / mem.totalJSHeapSize * 100) + '%'
      } : 'Memory API not available';
    }
  };

  // 页面卸载时自动清理
  window.addEventListener('beforeunload', () => {
    if (cleanup) cleanup();
    delete (window as any).__ORCA_ICON_REPLACER;
  });

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
