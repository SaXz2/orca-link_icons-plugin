export class IconCache {
  private store: Map<string, { url: string; timestamp: number }>;

  constructor(
    private storageKey: string,
    private maxSize: number,
  ) {
    this.store = this.load();
  }

  get(domain: string): string | undefined {
    const entry = this.store.get(domain);
    if (entry) {
      entry.timestamp = Date.now();
    }
    return entry?.url;
  }

  set(domain: string, url: string): void {
    this.store.set(domain, { url, timestamp: Date.now() });
    this.evict();
    this.persist();
  }

  clear(): void {
    this.store.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // localStorage 不可用时静默忽略
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
      const obj: Record<string, { url: string; timestamp: number }> = {};
      for (const [k, v] of this.store) {
        obj[k] = v;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch {
      // localStorage 不可用时静默忽略
    }
  }

  private load(): Map<string, { url: string; timestamp: number }> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        return new Map(Object.entries(JSON.parse(raw)));
      }
    } catch {
      // 缓存数据损坏时丢弃
    }
    return new Map();
  }
}
