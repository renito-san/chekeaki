/* ChekEAki — service worker (PWA)
   Estrategia segura a propósito:
   - HTML/navegación: NETWORK-FIRST. El directorio se actualiza seguido;
     nadie se queda atrapado con una versión vieja. La copia en caché
     solo se usa si no hay red.
   - Recursos propios (íconos, ayuda.jpg): cache-first con refresco
     desde la red cuando no están.
   - Todo lo demás (CSV de Google Sheets con aprobados y calificaciones,
     fuentes, y cualquier POST de formularios): NO se toca — pasa directo
     a la red, siempre fresco.
   Para invalidar todo en el futuro: subir el número de CACHE_VERSION. */
var CACHE_VERSION = 'chekeaki-v1';
var CORE = ['./', './index.html', './icon.png', './icon-192.png', './icon-512.png', './icon-180.png', './ayuda.jpg'];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache){
      /* Uno por uno con catch: si un recurso falla, la instalación no se cae. */
      return Promise.all(CORE.map(function(url){
        return cache.add(url).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return; /* votos, eventos y reportes (POST) pasan sin tocar */
  var url = new URL(req.url);
  var isOwn = url.origin === self.location.origin;
  var isHTML = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if(isHTML){
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(cache){ cache.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html', { ignoreSearch: true });
      })
    );
    return;
  }
  if(isOwn){
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function(hit){
        if(hit) return hit;
        return fetch(req).then(function(res){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
          return res;
        });
      })
    );
  }
  /* Origen cruzado (Sheets, fuentes): sin respondWith → red directa, sin caché. */
});
