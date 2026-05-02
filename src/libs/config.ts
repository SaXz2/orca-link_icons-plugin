export const CONFIG = {
  CACHE_KEY: 'orca-icon-cache-v3',
  MAX_CACHE_SIZE: 500,
  BATCH_SIZE: 15,
  LOAD_TIMEOUT: 5000,
  RETRY_COUNT: 2,
  DEBOUNCE_DELAY: 500,
  BATCH_INTERVAL: 100,
  FALLBACK_ICON: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMnptLTEgMTVoLTJ2LTJoMnYyem0wLTEzaC0ydjZoMnYtNnoiIGZpbGw9IiM2NjYiLz48L3N2Zz4=',

  SELECTOR: '.orca-inline[data-type="l"]',
  ICON_SELECTOR: '.ti.ti-world.orca-inline-l-icon',

  ICON_SOURCES: [
    (d: string) => `https://${d}/favicon.ico`,
    (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
    (d: string) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
    (d: string) => `https://favicon.yandex.net/favicon/${d}`,
  ],
} as const;
