'use client';

import { useCallback } from 'react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { saveOfflineRecord } from '@/lib/temporal-db';
import type { OfflineRecord } from '@/lib/temporal-db';

interface OfflineSyncState {
    readonly isOnline: boolean;
    readonly wasOffline: boolean;
    readonly saveRecordOffline: (record: Omit<OfflineRecord, 'id'>) => Promise<number>;
}

/**
 * Combines online/offline detection with IndexedDB persistence.
 *
 * Why this hook exists: RegistroProductosClient.tsx imported useOnlineStatus AND
 * saveOfflineRecord separately. This composes them into a single cohesive unit
 * that other pages (e.g., Temporal module) can also reuse.
 */
export function useOfflineSync(): OfflineSyncState {
    const { isOnline, wasOffline } = useOnlineStatus();

    const saveRecordOfflineWrapped = useCallback(
        async (record: Omit<OfflineRecord, 'id'>): Promise<number> => {
            return saveOfflineRecord(record);
        },
        []
    );

    return {
        isOnline,
        wasOffline,
        saveRecordOffline: saveRecordOfflineWrapped,
    };
}
