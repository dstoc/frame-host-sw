self.addEventListener('install', function(event) {
  self.skipWaiting();
});


self.addEventListener('activate', async function(event) {
  clients.claim();
});

const headers = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function contentType(url) {
  const [,extension] = url.pathname.match(/\.(\w{2,4})/) || [];
  return {
    'html': 'text/html',
    'js': 'text/javascript',
    'css': 'text/css',
  }[extension] ?? 'text/plain';
}

let hostId;
async function getHost(uuid) {
  if (hostId) {
    const host = await clients.get(hostId);
    if (host) return host;
  }
  for (const client of await clients.matchAll()) {
    if (client.url.endsWith(`/${uuid}/`)) {
      hostId = client.id;
      return client;
    }
  }
}

let uuid;
async function getUuid() {
  if (uuid) return uuid;
  const settings = await caches.open('settings');
  const request = new Request('uuid');
  const response = await settings.match(request);
  if (response) {
    uuid = await response.body.text();
    return uuid;
  }
  uuid = crypto.randomUUID();
  await settings.put(request, new Response(uuid));
}

const scopeUrl = new URL(self.registration.scope);
const hostPath = scopeUrl.pathname + 'host.html';
const hostScriptPath = scopeUrl.pathname + 'host.js';

self.addEventListener('fetch', async e => {
  const url = new URL(e.request.url);
  if (url.origin == location.origin) {
    const uuid = await getUuid();
    const hostTargetPath = `${scopeUrl.pathname}${uuid}/`;
    const hostScriptTargetPath = `${scopeUrl.pathname}${uuid}/host.js`;
    if (url.pathname == hostTargetPath) {
      e.respondWith((async () => {
        return new Response(await (await fetch(hostPath)).body, {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      })());
      return;
    }
    if (url.pathname == hostScriptTargetPath) {
      e.respondWith(fetch(hostScriptPath));
      return;
    }
    e.respondWith((async () => {
      try {
        const host = await getHost(uuid);
        if (!host) throw new Error(`No host, connect to ${new URL(scopeUrl, `${uuid}/`)}`);
        const mc = new MessageChannel();
        const pathname = url.pathname.substr(scopeUrl.pathname.length - 1);
        host.postMessage({get: pathname, port: mc.port2}, [mc.port2]);
        const result = await new Promise(resolve => {
          mc.port1.onmessage = e => {
            resolve(e.data);
          };
        });
        if (result == null) {
          return new Response('', {status: 404});
        }
        return new Response(result, {headers: {
          ...headers,
          'Content-Type': contentType(url),
        }});
      } catch (e) {
        return new Response(e.stack, {status: 404});
      }
    })());
  }
});
