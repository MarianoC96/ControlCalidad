'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on mount (production only).
 *
 * Why a component instead of a script tag: Next.js hydration
 * requires client-side effects to run inside `useEffect`. A raw
 * `<script>` in the head would execute before React hydrates,
 * potentially causing timing issues with the SW lifecycle.
 */
export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
            navigator.serviceWorker
                .register('/sw.js')
                .catch((err) => {
                    console.warn('SW registration failed:', err);
                });
        }
    }, []);

    return null;
}
