/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

// IMPORTANT: This module must be imported BEFORE any other imports
// to ensure fetch is patched before SDKs capture the reference.

function forceHttps(url: string): string {
  if (url && !url.includes('localhost') && !url.includes('127.0.0.1') && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

// Patch globalThis.fetch
const originalGlobalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const httpsUrl = forceHttps(url);

  if (httpsUrl !== url) {
    console.log('[Fetch Patch globalThis] Forcing HTTPS:', url, '->', httpsUrl);
    if (typeof input === 'string') {
      input = httpsUrl;
    } else if (input instanceof URL) {
      input = new URL(httpsUrl);
    } else {
      input = new Request(httpsUrl, input);
    }
  }

  return originalGlobalFetch(input, init);
};

// Also patch window.fetch (some SDKs use window.fetch directly)
if (typeof window !== 'undefined' && window.fetch !== globalThis.fetch) {
  const originalWindowFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const httpsUrl = forceHttps(url);

    if (httpsUrl !== url) {
      console.log('[Fetch Patch window] Forcing HTTPS:', url, '->', httpsUrl);
      if (typeof input === 'string') {
        input = httpsUrl;
      } else if (input instanceof URL) {
        input = new URL(httpsUrl);
      } else {
        input = new Request(httpsUrl, input);
      }
    }

    return originalWindowFetch(input, init);
  };
  console.log('[Fetch Patch] window.fetch patched');
}

// Patch XMLHttpRequest.open (fallback in case SDK uses XHR)
if (typeof XMLHttpRequest !== 'undefined') {
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
    let urlStr = typeof url === 'string' ? url : url.href;
    const httpsUrl = forceHttps(urlStr);

    if (httpsUrl !== urlStr) {
      console.log('[XHR Patch] Forcing HTTPS:', urlStr, '->', httpsUrl);
      urlStr = httpsUrl;
    }

    return originalOpen.call(this, method, urlStr, ...args);
  };
  console.log('[Fetch Patch] XMLHttpRequest.open patched');
}

console.log('[Fetch Patch] All fetch mechanisms patched for HTTPS enforcement');

export {};
