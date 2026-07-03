'use client';

import useSWR, { type SWRConfiguration, type KeyedMutator } from 'swr';
import type { Producto, Parametro } from '@/lib/supabase/types';

/**
 * Standard fetcher for SWR hooks.
 * Throws on non-OK responses so SWR can surface errors properly.
 */
const fetcher = async <T>(url: string): Promise<T> => {
    const response = await fetch(url);

    if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(body.error || `HTTP ${response.status}`);
    }

    return response.json();
};

// ─── Generic Types ───────────────────────────────────────────

interface SWRDataHook<T> {
    readonly data: T | undefined;
    readonly error: Error | undefined;
    readonly isLoading: boolean;
    readonly isValidating: boolean;
    readonly mutate: KeyedMutator<T>;
}

// ─── useProductos ────────────────────────────────────────────

/** Product with optional nested parameters (when includeParams=true) */
type ProductoWithParams = Producto & { parametros?: Parametro[] };

/**
 * Fetches products list. Pass `includeParams: true` to also load
 * each product's quality parameters in a single query.
 *
 * Why SWR: products are read frequently from multiple components
 * (RegistroProductos, Productos admin). SWR's in-memory cache
 * avoids duplicate network requests and stale-while-revalidate
 * gives instant display on revisit.
 */
export function useProductos(
    options: { includeParams?: boolean } = {},
    swrConfig?: SWRConfiguration
): SWRDataHook<ProductoWithParams[]> {
    const queryParam = options.includeParams ? '?includeParams=true' : '';
    const key = `/api/productos${queryParam}`;

    const { data, error, isLoading, isValidating, mutate } = useSWR<ProductoWithParams[]>(
        key,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 30_000,
            ...swrConfig,
        }
    );

    return { data, error, isLoading, isValidating, mutate };
}
