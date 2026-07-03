import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';


/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format date to locale string (Spanish)
 */
export function formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format date for display (only date, no time)
 */
export function formatDateOnly(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

/**
 * Get current date formatted
 */
export function getCurrentDate(): string {
    return new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Extract range values from text format "min - max unit"
 */
export function extractRange(rangeText: string): {
    min: number;
    max: number;
    unit: string;
} | null {
    const match = rangeText.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(.*)?/);
    if (match) {
        return {
            min: parseFloat(match[1]),
            max: parseFloat(match[2]),
            unit: match[3]?.trim() || '',
        };
    }
    return null;
}

/**
 * Validate if a value is within range
 */
export function validateRange(
    value: number | null | undefined,
    rangeMin: number,
    rangeMax: number
): {
    isValid: boolean;
    message: string;
} {
    if (value === null || value === undefined || isNaN(value)) {
        return {
            isValid: false,
            message: `El valor no puede estar vacío (${rangeMin} - ${rangeMax}).`,
        };
    }

    if (value < rangeMin) {
        return {
            isValid: false,
            message: `Valor '${value}' fuera de rango (${rangeMin} - ${rangeMax}).`,
        };
    }
    if (value > rangeMax) {
        return {
            isValid: false,
            message: `Valor '${value}' fuera de rango (${rangeMin} - ${rangeMax}).`,
        };
    }
    return { isValid: true, message: '' };
}

/**
 * Normalize string (remove accents, lowercase)
 */
export function normalizeString(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Validate if text matches expected value (case insensitive)
 */
export function validateText(
    value: string,
    expected: string
): {
    isValid: boolean;
    message: string;
} {
    const normalize = normalizeString;
    const normalizedValue = normalize(value);

    // Permitir múltiples opciones separadas por "/"
    const expectedOptions = expected.split('/').map(opt => normalize(opt));

    const isValid = expectedOptions.includes(normalizedValue);

    return {
        isValid,
        message: isValid
            ? ''
            : `El valor '${value}' no coincide con el esperado '${expected}'.`,
    };
}

/**
 * Format range for display
 */
export function formatRange(
    min: number | null,
    max: number | null,
    unit: string | null
): string {
    if (min === null || max === null) return '';
    const unitStr = unit ? ` ${unit}` : '';
    return `${min} - ${max}${unitStr}`;
}

/**
 * Normaliza el código de barras rellenando con ceros a la izquierda
 * según el estándar de la empresa:
 * - Productos: 13 dígitos
 * - Cajas: 14 dígitos
 * 
 * S.O.L.I.D. - Single Responsibility: Esta función solo se encarga de la normalización.
 */
export function formatBarcode(barcode: string, mode: 'producto' | 'caja'): string {
    const targetLength = mode === 'producto' ? 13 : 14;
    return barcode.trim().padStart(targetLength, '0');
}

