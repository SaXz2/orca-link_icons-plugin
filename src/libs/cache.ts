type CacheEntry = {
  url: string | null;
  timestamp: number;
  failedAt?: number;
};

function isCacheableIconUrl(url: string): boolean {
  return url.startsWith('data:image/');
}

export class IconCache {
  private store: Map<string, CacheEntry>;

  constructor(
    private storageKey: string,
    private maxSize: number,
    private maxStorageChars: number,
    private failureTtl: number,
  ) {
    this.store = this.load();
  }

  get(domain: string): string | null | undefined {
    const entry = this.store.get(domain);
    if (!entry) return undefined;

    const now = Date.now();
    if (
      entry.url === null &&
      now - (entry.failedAt ?? entry.timestamp) > this.failureTtl
    ) {
      this.store.delete(domain);
      this.persist();
      return undefined;
    }

    entry.timestamp = now;
    return entry.url;
  }

  set(domain: string, url: string | null): void {
    if (typeof url === 'string' && !isCacheableIconUrl(url)) {
      return;
    }

    const now = Date.now();
    this.store.set(domain, {
      url,
      timestamp: now,
      ...(url === null ? { failedAt: now } : {}),
    });
    this.evict();
    this.persist();
  }

  clear(): void {
    this.store.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore when localStorage is unavailable.
    }
  }

  get size(): number {
    return this.store.size;
  }

  private evict(): void {
    if (this.store.size <= this.maxSize) return;

    const entries = [...this.store.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    const toRemove = entries.slice(0, this.store.size - this.maxSize);
    for (const [key] of toRemove) {
      this.store.delete(key);
    }
  }

  private persist(): void {
    try {
      this.evictByStorageSize();
      const obj: Record<string, CacheEntry> = {};
      for (const [k, v] of this.store) {
        obj[k] = v;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch {
      // Ignore when localStorage is unavailable.
    }
  }

  private evictByStorageSize(): void {
    while (this.store.size > 0) {
      const size = JSON.stringify(Object.fromEntries(this.store)).length;
      if (size <= this.maxStorageChars) return;

      const oldest = [...this.store.entries()].sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      )[0]?.[0];
      if (!oldest) return;

      this.store.delete(oldest);
    }
  }

  private load(): Map<string, CacheEntry> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
        const entries = Object.entries(parsed).filter(([, entry]) => {
          return (
            entry &&
            ((typeof entry.url === 'string' &&
              isCacheableIconUrl(entry.url)) ||
              entry.url === null) &&
            typeof entry.timestamp === 'number'
          );
        });
        return new Map(entries);
      }
    } catch {
      // Drop corrupt cache data.
    }
    return new Map();
  }
}
