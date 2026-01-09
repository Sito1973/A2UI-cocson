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

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Force HTTPS for non-localhost URLs
  if (url && !url.includes('localhost') && !url.includes('127.0.0.1') && url.startsWith('http://')) {
    const httpsUrl = url.replace('http://', 'https://');
    console.log('[Fetch Patch] Forcing HTTPS:', url, '->', httpsUrl);

    if (typeof input === 'string') {
      input = httpsUrl;
    } else if (input instanceof URL) {
      input = new URL(httpsUrl);
    } else {
      input = new Request(httpsUrl, input);
    }
  }

  return originalFetch(input, init);
};

console.log('[Fetch Patch] Global fetch patched for HTTPS enforcement');

export {};
