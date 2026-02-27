'use client';

import useSWR, { type SWRConfiguration, type KeyedMutator } from 'swr';
import type { Producto, Parametro, ParametroMaestro } from '@/lib/supabase/types';

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

// ─── useParametrosMaestros ───────────────────────────────────

/**
 * Fetches the global master parameters list.
 * Used by admin CRUD pages and RegistroProductos for parameter definitions.
 */
export function useParametrosMaestros(swrConfig?: SWRConfiguration): SWRDataHook<ParametroMaestro[]> {
    const { data, error, isLoading, isValidating, mutate } = useSWR<ParametroMaestro[]>(
        '/api/parametros-maestros',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60_000,
            ...swrConfig,
        }
    );

    return { data, error, isLoading, isValidating, mutate };
}

// ─── useEditRequests ─────────────────────────────────────────

interface EditRequest {
    id: number;
    registro_id: number;
    usuario_id: number;
    motivo: string;
    estado: string;
    created_at: string;
    usuario_nombre?: string;
    registro_info?: string;
}

/**
 * Fetches pending edit requests (admin view).
 * Conditionally fetches only when `enabled` is true (e.g. user is admin).
 */
export function useEditRequests(
    enabled = true,
    swrConfig?: SWRConfiguration
): SWRDataHook<EditRequest[]> {
    const { data, error, isLoading, isValidating, mutate } = useSWR<EditRequest[]>(
        enabled ? '/api/admin/edit-requests' : null,
        fetcher,
        {
            revalidateOnFocus: false,
            ...swrConfig,
        }
    );

    return { data, error, isLoading, isValidating, mutate };
}

// ─── useRoles ────────────────────────────────────────────────

interface Role {
    id: number;
    nombre: string;
    permisos: Record<string, boolean>;
}

/**
 * Fetches available roles with their permissions.
 * Used by AccesosClient for role management.
 */
export function useRoles(swrConfig?: SWRConfiguration): SWRDataHook<Role[]> {
    const { data, error, isLoading, isValidating, mutate } = useSWR<Role[]>(
        '/api/roles',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60_000,
            ...swrConfig,
        }
    );

    return { data, error, isLoading, isValidating, mutate };
}

// ─── usePdfConfig ────────────────────────────────────────────

interface PdfConfig {
    id?: number;
    empresa: string;
    logo_url: string;
    direccion: string;
    telefono: string;
    email: string;
    pie_pagina: string;
}

/**
 * Fetches PDF configuration for report generation.
 * Used by ConfigPdfClient and RegistrosClient (for PDF generation).
 */
export function usePdfConfig(swrConfig?: SWRConfiguration): SWRDataHook<PdfConfig> {
    const { data, error, isLoading, isValidating, mutate } = useSWR<PdfConfig>(
        '/api/config/pdf',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 120_000,
            ...swrConfig,
        }
    );

    return { data, error, isLoading, isValidating, mutate };
}

// ─── usePendingCounts ────────────────────────────────────────

interface PendingCounts {
    editRequests: number;
    temporalRecords: number;
}

/**
 * Fetches pending counts for admin dashboard badges.
 */
export function usePendingCounts(
    enabled = true,
    swrConfig?: SWRConfiguration
): SWRDataHook<PendingCounts> {
    const { data, error, isLoading, isValidating, mutate } = useSWR<PendingCounts>(
        enabled ? '/api/admin/pending-counts' : null,
        fetcher,
        {
            refreshInterval: 60_000,
            ...swrConfig,
        }
    );

    return { data, error, isLoading, isValidating, mutate };
}
