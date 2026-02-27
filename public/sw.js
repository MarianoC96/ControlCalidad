/// <reference lib="webworker" />

/**
 * Service Worker for Control de Calidad PWA.
 *
 * Strategy: Cache-First for static assets (CSS, JS, images, fonts),
 * Network-First for API calls (always prefer fresh data).
 *
 * Why not Workbox: the app is small enough that a simple hand-rolled
 * SW avoids the ~12KB Workbox overhead. If caching requirements grow,
 * migrate to Workbox.
 */

const CACHE_NAME = 'qc-system-v1';
const STATIC_CACHE_NAME = 'qc-static-v1';

/** Assets to pre-cache on install (app shell) */
const APP_SHELL_ASSETS = [
    '/',
    '/manifest.json',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    '/logo.png',
];

/** Extensions that should be cached using Cache-First strategy */
const CACHEABLE_EXTENSIONS = ['.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff2', '.woff'];

// ─── Install ─────────────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL_ASSETS);
        })
    );
    // Activate immediately, don't wait for old SW to finish
    self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
    // Clean up old caches from previous versions
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    // Take control of all open tabs immediately
    self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (POST, PUT, DELETE go straight to network)
    if (request.method !== 'GET') return;

    // Skip Supabase API calls (auth tokens, realtime, etc.)
    if (url.hostname.includes('supabase')) return;

    // API routes: Network-First (prefer fresh data, fallback to cache)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets: Cache-First (fast load from cache, background refresh)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // Navigation requests (HTML pages): Network-First
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
});

// ─── Strategies ──────────────────────────────────────────────

async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Offline fallback — return a basic response
        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Network failed, try cache
        const cached = await caches.match(request);
        if (cached) return cached;

        // No cache either — return offline fallback for navigation
        if (request.mode === 'navigate') {
            const cachedHome = await caches.match('/');
            if (cachedHome) return cachedHome;
        }

        return new Response(
            JSON.stringify({ error: 'Sin conexión' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function isStaticAsset(pathname) {
    return CACHEABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}
