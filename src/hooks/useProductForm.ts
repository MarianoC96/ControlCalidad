'use client';

import { useState, useCallback, useEffect } from 'react';
import { formatRange, validateRange, validateText } from '@/lib/utils';
import { getCachedProduct } from '@/lib/temporal-db';
import { registroFormSchema, formatZodErrors } from '@/lib/schemas';
import type { RegistroFormData } from '@/lib/schemas';
import type { Producto, Parametro } from '@/lib/supabase/types';

/** Individual control value for a quality parameter measurement */
export interface ControlValue {
    parametroNombre: string;
    rangoCompleto: string;
    valorControl: number | null;
    textoControl: string | null;
    parametroTipo: string;
    observacion: string;
    fueraDeRango: boolean;
    mensajeAlerta: string;
}

/** Re-export for consumers that need the type */
export type { RegistroFormData } from '@/lib/schemas';

const INITIAL_FORM_DATA: RegistroFormData = {
    loteInterno: '',
    loteProducto: '',
    guia: '',
    marca: '',
    cantidad: '',
    productoId: '',
    observacionesGenerales: '',
};

interface UseProductFormReturn {
    readonly formData: RegistroFormData;
    readonly parametros: Parametro[];
    readonly controles: ControlValue[];
    readonly loadingParametros: boolean;
    readonly touched: boolean;
    readonly fieldErrors: Record<string, string>;
    readonly setFormData: React.Dispatch<React.SetStateAction<RegistroFormData>>;
    readonly setTouched: React.Dispatch<React.SetStateAction<boolean>>;
    readonly handleControlChange: (index: number, field: 'valor' | 'texto' | 'observacion', value: string) => void;
    readonly resetForm: () => void;
    readonly validateForm: () => boolean;
}

/**
 * Builds an array of ControlValue from parameter definitions.
 * Pure function — no side effects.
 */
function buildInitialControles(params: Parametro[]): ControlValue[] {
    return params.map((param) => {
        const isRango = param.tipo === 'rango' || param.es_rango;
        let initialFueraDeRango = false;
        let initialMensajeAlerta = '';

        if (isRango && param.rango_min !== null && param.rango_max !== null) {
            // Null initial value is technically "Out of range" because it's required
            const validation = validateRange(null, param.rango_min, param.rango_max);
            initialFueraDeRango = !validation.isValid;
            initialMensajeAlerta = validation.message;
        } else if (!isRango && param.tipo === 'texto') {
            const targetText = param.valor_texto || param.valor;
            if (targetText && typeof targetText === 'string' && targetText.trim() !== '') {
                const validation = validateText('', targetText);
                initialFueraDeRango = !validation.isValid;
                initialMensajeAlerta = validation.message;
            }
        }

        return {
            parametroNombre: param.nombre,
            rangoCompleto: param.rango_completo
                ? param.rango_completo
                : param.tipo === 'rango'
                    ? formatRange(param.rango_min, param.rango_max, param.unidad)
                    : param.valor_texto || param.valor || '',
            valorControl: null,
            textoControl: null,
            parametroTipo: param.tipo,
            observacion: '',
            fueraDeRango: initialFueraDeRango,
            mensajeAlerta: initialMensajeAlerta,
        };
    });
}

/**
 * Manages the registration form state, parameter loading, control value changes,
 * and range/text validation logic.
 *
 * Why this hook exists: RegistroProductosClient.tsx mixed form state management
 * (~200 lines) with UI rendering (~800 lines). Extracting the domain logic
 * makes both easier to maintain and test independently.
 */
export function useProductForm(productos: Producto[]): UseProductFormReturn {
    const [formData, setFormData] = useState<RegistroFormData>(INITIAL_FORM_DATA);
    const [parametros, setParametros] = useState<Parametro[]>([]);
    const [controles, setControles] = useState<ControlValue[]>([]);
    const [loadingParametros, setLoadingParametros] = useState(false);
    const [touched, setTouched] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    /**
     * Initializes control values from parameter definitions.
     * Called when product selection changes and parameters are loaded.
     */
    const initializeControles = useCallback((params: Parametro[]) => {
        setParametros(params);
        setControles(buildInitialControles(params));
    }, []);

    /**
     * Loads parameters for a selected product.
     * Strategy: in-memory → IndexedDB cache → API (network fallback).
     */
    const loadParametros = useCallback(
        async (productoId: string) => {
            if (!productoId) {
                setParametros([]);
                setControles([]);
                return;
            }

            setLoadingParametros(true);

            try {
                // 1. Check in-memory product list (already fetched)
                const prodInMemory = productos.find((p) => p.id === parseInt(productoId)) as
                    | (Producto & { parametros?: Parametro[] })
                    | undefined;

                if (prodInMemory?.parametros && prodInMemory.parametros.length > 0) {
                    initializeControles(prodInMemory.parametros);
                    setLoadingParametros(false);
                    return;
                }

                // 2. Check IndexedDB cache (populated by background sync)
                const cachedProd = await getCachedProduct(parseInt(productoId));
                if (cachedProd?.parametros && (cachedProd.parametros as Parametro[]).length > 0) {
                    initializeControles(cachedProd.parametros as Parametro[]);
                    setLoadingParametros(false);
                    return;
                }

                // 3. Fall back to network API
                const response = await fetch(`/api/productos?id=${productoId}`);
                if (!response.ok) throw new Error('Error al cargar detalles del producto');

                const productoDetalle = await response.json();
                initializeControles(productoDetalle.parametros || []);
            } catch (err) {
                console.error('Error loading parametros:', err);
            } finally {
                setLoadingParametros(false);
            }
        },
        [productos, initializeControles]
    );

    // Reload parameters when selected product changes
    useEffect(() => {
        loadParametros(formData.productoId);
    }, [formData.productoId, loadParametros]);

    /**
     * Handles changes to individual control measurements.
     * Validates numeric values against defined ranges and text values against expected values.
     */
    const handleControlChange = useCallback(
        (index: number, field: 'valor' | 'texto' | 'observacion', value: string) => {
            setControles((prev) => {
                const updated = [...prev];
                const control = { ...updated[index] };
                const parametro = parametros[index];

                if (field === 'valor') {
                    let numValue = parseFloat(value);

                    // Prevent negative values
                    if (!isNaN(numValue) && numValue < 0) {
                        numValue = Math.abs(numValue);
                    }

                    control.valorControl = isNaN(numValue) ? null : numValue;

                    // Validate against range
                    const isRango = parametro.tipo === 'rango' || parametro.es_rango;
                    if (isRango && parametro.rango_min !== null && parametro.rango_max !== null) {
                        const validation = validateRange(numValue, parametro.rango_min, parametro.rango_max);
                        control.fueraDeRango = !validation.isValid;
                        control.mensajeAlerta = validation.message;
                    }
                } else if (field === 'texto') {
                    control.textoControl = value;

                    // Validate text match
                    const isRango = parametro.tipo === 'rango' || parametro.es_rango;
                    const targetText = parametro.valor_texto || parametro.valor;

                    if (!isRango && parametro.tipo === 'texto' && targetText) {
                        const validation = validateText(value, targetText);
                        control.fueraDeRango = !validation.isValid;
                        control.mensajeAlerta = validation.message;
                    }
                } else {
                    control.observacion = value;
                }

                updated[index] = control;
                return updated;
            });
        },
        [parametros]
    );

    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setControles([]);
        setTouched(false);
        setFieldErrors({});
    }, []);

    /**
     * Validates the form using the Zod schema.
     * Returns true if valid, false if invalid.
     * Sets fieldErrors for inline UI display.
     */
    const validateForm = useCallback((): boolean => {
        const result = registroFormSchema.safeParse(formData);

        if (!result.success) {
            setFieldErrors(formatZodErrors(result.error));
            return false;
        }

        setFieldErrors({});
        return true;
    }, [formData]);

    return {
        formData,
        parametros,
        controles,
        loadingParametros,
        touched,
        fieldErrors,
        setFormData,
        setTouched,
        handleControlChange,
        resetForm,
        validateForm,
    };
}
