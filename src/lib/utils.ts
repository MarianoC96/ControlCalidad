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
    value: number,
    rangeMin: number,
    rangeMax: number
): {
    isValid: boolean;
    message: string;
} {
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

    const isValid = normalize(value) === normalize(expected);
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
 * Simple hash function for passwords (for demo - use bcrypt in production)
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}
