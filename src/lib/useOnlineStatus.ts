'use client';

import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
    isOnline: boolean;
    wasOffline: boolean;
}

/**
 * Hook to detect online/offline status changes.
 * - `isOnline`: current connectivity state
 * - `wasOffline`: true if was offline and just came back online (resets after 5s)
 */
export function useOnlineStatus(): OnlineStatus {
    const [isOnline, setIsOnline] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);

    const handleOnline = useCallback(() => {
        setIsOnline(true);
        setWasOffline(true);
        // Reset wasOffline after 5 seconds
        setTimeout(() => setWasOffline(false), 5000);
    }, []);

    const handleOffline = useCallback(() => {
        setIsOnline(false);
    }, []);

    useEffect(() => {
        // Set initial state
        setIsOnline(navigator.onLine);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [handleOnline, handleOffline]);

    return { isOnline, wasOffline };
}
