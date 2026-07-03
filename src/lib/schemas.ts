import { z } from 'zod';

/**
 * Zod schemas for form validation across the QC system.
 *
 * Why centralized: having a single source of truth for validation rules
 * ensures consistency between frontend forms and API route validation.
 * Each schema can be reused in both `useProductForm` (client) and
 * API routes (server).
 */

// ─── Shared Refinements ──────────────────────────────────────

const nonEmptyString = (fieldName: string) =>
    z.string().trim().min(1, { message: `${fieldName} es requerido` });

const positiveInteger = (fieldName: string) =>
    z.string().trim().min(1, { message: `${fieldName} es requerido` }).refine(
        (val) => {
            const num = parseInt(val, 10);
            return !isNaN(num) && num > 0;
        },
        { message: `${fieldName} debe ser un número entero positivo` }
    );

// ─── Registro de Productos ──────────────────────────────────

export const registroFormSchema = z.object({
    loteInterno: nonEmptyString('Lote Interno'),
    loteProducto: nonEmptyString('Lote de Producto'),
    guia: nonEmptyString('Guía'),
    marca: nonEmptyString('Marca'),
    cantidad: positiveInteger('Cantidad'),
    productoId: nonEmptyString('Producto'),
    observacionesGenerales: z.string().optional().default(''),
});

export type RegistroFormData = z.infer<typeof registroFormSchema>;

// ─── Control de Calidad (individual parameter value) ─────────

export const controlValueSchema = z.object({
    parametroNombre: z.string(),
    rangoCompleto: z.string(),
    valorControl: z.number().nullable(),
    textoControl: z.string().nullable(),
    parametroTipo: z.string(),
    observacion: z.string().default(''),
    fueraDeRango: z.boolean().default(false),
    mensajeAlerta: z.string().default(''),
});

export type ControlValue = z.infer<typeof controlValueSchema>;

// ─── Login ───────────────────────────────────────────────────

export const loginSchema = z.object({
    usuario: nonEmptyString('Usuario'),
    password: z
        .string()
        .min(1, { message: 'Contraseña es requerida' })
        .refine((val) => !val.includes(' '), {
            message: 'La contraseña no puede contener espacios',
        }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Producto (admin CRUD) ───────────────────────────────────

export const productoSchema = z.object({
    nombre: nonEmptyString('Nombre del producto'),
});

export type ProductoFormData = z.infer<typeof productoSchema>;

// ─── Parámetro Maestro (admin CRUD) ─────────────────────────

export const parametroMaestroSchema = z.object({
    nombre: nonEmptyString('Nombre del parámetro'),
    tipo: z.enum(['rango', 'texto', 'numero'], {
        message: 'Tipo debe ser rango, texto o numero',
    }),
    valor: z.string().nullable().optional(),
    valor_texto: z.string().nullable().optional(),
    es_rango: z.boolean().default(false),
    rango_min: z.number().nullable().optional(),
    rango_max: z.number().nullable().optional(),
    unidad: z.string().nullable().optional(),
});

export type ParametroMaestroFormData = z.infer<typeof parametroMaestroSchema>;

// ─── Producto (admin CRUD, con parámetros anidados) ──────────

/**
 * Parámetro anidado de un producto (tabla `parametros`).
 * Sirve para whitelistear campos en POST/PUT /api/productos y cerrar el
 * mass-assignment: solo estos campos llegan al insert/update.
 */
export const productoParametroSchema = z.object({
    parametro_maestro_id: z.number().int().positive().nullable().optional(),
    nombre: nonEmptyString('Nombre del parámetro'),
    tipo: z.enum(['rango', 'texto', 'numero']).default('texto'),
    valor: z.string().nullable().optional(),
    valor_texto: z.string().nullable().optional(),
    es_rango: z.boolean().default(false),
    rango_min: z.number().nullable().optional(),
    rango_max: z.number().nullable().optional(),
    unidad: z.string().nullable().optional(),
});

export type ProductoParametroData = z.infer<typeof productoParametroSchema>;

export const productoCreateSchema = z.object({
    nombre: nonEmptyString('Nombre del producto'),
    parametros: z.array(productoParametroSchema).optional().default([]),
});

export type ProductoCreateData = z.infer<typeof productoCreateSchema>;

export const productoUpdateSchema = productoCreateSchema.extend({
    id: z.number().int().positive(),
});

export type ProductoUpdateData = z.infer<typeof productoUpdateSchema>;

// ─── Parámetro Maestro (upsert: tabla `parametros_maestros`) ──

/**
 * La tabla `parametros_maestros` solo tiene `nombre` y `tipo` (lo confirma la
 * ruta `estandarizar` y el cliente). Este schema acota el body exactamente a
 * esos campos para cerrar el mass-assignment del antiguo `insert(body)`.
 * (`parametroMaestroSchema`, más arriba, modela el parámetro de formulario, no
 * esta tabla; por eso se usa un schema propio aquí.)
 */
export const parametroMaestroUpsertSchema = z.object({
    nombre: nonEmptyString('Nombre del parámetro'),
    tipo: z.enum(['rango', 'texto', 'numero'], {
        message: 'Tipo debe ser rango, texto o numero',
    }),
});

export type ParametroMaestroUpsertData = z.infer<typeof parametroMaestroUpsertSchema>;

// ─── ID en body (para PUT/DELETE simples) ────────────────────

export const idBodySchema = z.object({
    id: z.number().int().positive({ message: 'ID inválido' }),
});

// ─── Usuario (admin CRUD) ────────────────────────────────────

/**
 * Whitelist del body de POST /api/usuarios (cierra el mass-assignment):
 * el email NO se acepta del cliente porque el servidor lo autogenera
 * (`usuario@controlcalidad.local`).
 */
export const passwordSchema = z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .refine((val) => /[A-Z]/.test(val), {
        message: 'La contraseña debe incluir al menos una mayúscula',
    })
    .refine((val) => /[0-9]/.test(val), {
        message: 'La contraseña debe incluir al menos un número',
    })
    .refine((val) => !val.includes(' '), {
        message: 'La contraseña no puede contener espacios',
    });

export const usuarioCreateSchema = z.object({
    nombre_completo: nonEmptyString('Nombre completo'),
    usuario: nonEmptyString('Usuario')
        .refine((val) => !val.includes(' '), {
            message: 'El usuario no puede contener espacios',
        }),
    password: passwordSchema,
    roles: z.enum(['administrador', 'trabajador']).default('trabajador'),
    role_id: z.number().int().positive().nullable().optional(),
});

export type UsuarioCreateData = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = usuarioCreateSchema.partial().extend({
    id: z.number().int().positive(),
});

export type UsuarioUpdateData = z.infer<typeof usuarioUpdateSchema>;

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Formats Zod errors into a flat record keyed by field name.
 * Useful for displaying inline validation messages in forms.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.join('.');
        if (!errors[key]) {
            errors[key] = issue.message;
        }
    }
    return errors;
}
