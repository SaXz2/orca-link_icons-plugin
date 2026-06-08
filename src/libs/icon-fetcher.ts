function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  onTimeout: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error('Timeout'));
    }, timeout);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read icon data'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function validateImage(src: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new Error('Image decode timeout'));
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(src);
    };

    img.onerror = () => {
      clearTimeout(timer);
      img.src = '';
      reject(new Error('Invalid image'));
    };

    img.src = src;
  });
}

async function fetchDataUrl(
  src: string,
  timeout: number,
  maxBytes: number,
): Promise<string> {
  const controller = new AbortController();
  const response = await withTimeout(
    fetch(src, {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }),
    timeout,
    () => controller.abort(),
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size === 0) {
    throw new Error('Response is not an image');
  }
  if (blob.size > maxBytes) {
    throw new Error('Icon is too large');
  }

  return blobToDataUrl(blob);
}

async function loadIconSource(
  src: string,
  timeout: number,
  maxBytes: number,
): Promise<string> {
  const dataUrl = await fetchDataUrl(src, Math.floor(timeout * 0.8), maxBytes);
  return validateImage(dataUrl, Math.floor(timeout * 0.2));
}

async function trySources(
  sources: string[],
  timeout: number,
  maxBytes: number,
): Promise<string | null> {
  const deadline = Date.now() + timeout;
  const perSourceTimeout = Math.max(
    800,
    Math.floor(timeout / Math.max(1, sources.length)),
  );

  for (const src of sources) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;

    try {
      return await loadIconSource(
        src,
        Math.min(remaining, perSourceTimeout),
        maxBytes,
      );
    } catch {
      // Try the next source.
    }
  }

  return null;
}

export interface FetchOptions {
  sources: string[];
  timeout: number;
  maxRetries: number;
  maxBytes: number;
}

export async function fetchIcon(
  domain: string,
  options: FetchOptions,
): Promise<string | null> {
  const { sources, timeout, maxRetries, maxBytes } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await trySources(sources, timeout, maxBytes);
    if (result) return result;

    if (attempt < maxRetries) {
      const delay = Math.min(500 * Math.pow(2, attempt), 4000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}
