function loadImage(src: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new Error('Timeout'));
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(src);
    };

    img.onerror = () => {
      clearTimeout(timer);
      img.src = '';
      reject(new Error('Failed to load'));
    };

    img.src = src;
  });
}

async function raceSources(
  sources: string[],
  timeout: number,
): Promise<string | null> {
  const perSourceTimeout = Math.floor(timeout * 0.7);

  try {
    const result = await Promise.race([
      Promise.any(sources.map((src) => loadImage(src, perSourceTimeout))),
      new Promise<null>((r) => setTimeout(() => r(null), timeout)),
    ]);
    return result;
  } catch {
    return null;
  }
}

export interface FetchOptions {
  sources: string[];
  timeout: number;
  maxRetries: number;
}

export async function fetchIcon(
  domain: string,
  options: FetchOptions,
): Promise<string | null> {
  const { sources, timeout, maxRetries } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await raceSources(sources, timeout);
    if (result) return result;

    if (attempt < maxRetries) {
      const delay = Math.min(500 * Math.pow(2, attempt), 4000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return null;
}
