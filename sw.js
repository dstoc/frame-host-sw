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
  }[extension] ?? 'text/plain';
}

let hostId;
async function getHost() {
  if (hostId) {
    const host = await clients.get(hostId);
    if (host) return host;
  }
  for (const client of await clients.matchAll()) {
    if (client.url.endsWith('host.html')) {
      hostId = client.id;
      return client;
    }
  }
}

const scopeUrl = new URL(self.registration.scope);
const hostPath = scopeUrl.pathname + 'host.html';
const hostScriptPath = scopeUrl.pathname + 'host.js';

self.addEventListener('fetch', async e => {
  const url = new URL(e.request.url);
  if (url.origin == location.origin) {
    if (url.pathname == hostPath) {
      e.respondWith((async () => {
        return new Response(await (await fetch(hostPath)).body, {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      })());
      return;
    }
    if (url.pathname == hostScriptPath) {
      e.respondWith(fetch(hostScriptPath));
      return;
    }
    e.respondWith((async () => {
      try {
        const host = await getHost();
        if (!host) throw new Error('no host');
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
