import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api/withAuth';
import { createServiceClient } from '@/lib/supabase/admin-client';
import { getAppUserById, userHasModule } from '@/lib/api/permissions';
import {
    productoCreateSchema,
    productoUpdateSchema,
    idBodySchema,
    formatZodErrors,
    type ProductoParametroData,
} from '@/lib/schemas';

const MODULE_KEY = 'productos';

/**
 * Solo sesión (para lecturas). Devuelve el auth o una respuesta de error.
 */
async function requireSession() {
    const auth = await getAuthUserId();
    if (!auth) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }
    return { auth };
}

/**
 * Sesión + permiso del módulo `productos` (para mutaciones).
 */
async function requireModule() {
    const auth = await getAuthUserId();
    if (!auth) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }

    const user = await getAppUserById(parseInt(auth.userId, 10));
    if (!user || !(await userHasModule(user, MODULE_KEY))) {
        return {
            error: NextResponse.json(
                { error: 'No autorizado. Se requiere permiso del módulo de productos.' },
                { status: 403 }
            ),
        };
    }
    return { auth, user };
}

/**
 * Convierte un parámetro YA validado al objeto JSON que consumen las RPC
 * `crear_producto_con_parametros` / `reemplazar_producto_parametros`.
 * Solo se incluyen campos del whitelist (cierra el mass-assignment) y se deriva
 * `rango_completo` en el servidor.
 */
function paramToJson(p: ProductoParametroData) {
    return {
        parametro_maestro_id: p.parametro_maestro_id ?? null,
        nombre: p.nombre,
        tipo: p.tipo,
        valor: p.valor ?? null,
        es_rango: p.es_rango,
        rango_min: p.rango_min ?? null,
        rango_max: p.rango_max ?? null,
        unidad: p.unidad ?? null,
        valor_texto: p.valor_texto ?? null,
        rango_completo: p.es_rango
            ? `${p.rango_min ?? ''} - ${p.rango_max ?? ''} ${p.unidad ?? ''}`.trim()
            : null,
    };
}

// ─── GET (lectura: solo sesión) ──────────────────────────────

export async function GET(request: Request) {
    try {
        const session = await requireSession();
        if ('error' in session) return session.error;

        const supabase = createServiceClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const includeParams = searchParams.get('includeParams') === 'true';

        if (id) {
            const { data: producto, error } = await supabase
                .from('productos')
                .select('*, parametros(*)')
                .eq('id', id)
                .single();
            if (error) throw error;
            return NextResponse.json(producto);
        }

        const { data, error } = await supabase
            .from('productos')
            .select(includeParams ? '*, parametros(*)' : '*')
            .order('nombre');
        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

// ─── POST (crear: permiso de módulo + validación) ────────────

export async function POST(request: Request) {
    try {
        const access = await requireModule();
        if ('error' in access) return access.error;

        const rawBody = await request.json().catch(() => null);
        const parsed = productoCreateSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', detalles: formatZodErrors(parsed.error) },
                { status: 400 }
            );
        }
        const { nombre, parametros } = parsed.data;

        const supabase = createServiceClient();

        // Alta atómica vía RPC transaccional.
        // ⚠️ REQUIERE migración 20260624000002_rpc_productos_transaccional.sql
        //    aplicada en la BD; sin ella, esta ruta responderá error.
        const { data: producto, error } = await supabase.rpc('crear_producto_con_parametros', {
            p_nombre: nombre,
            p_parametros: parametros.map(paramToJson),
        });
        if (error) throw error;

        return NextResponse.json(producto);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

// ─── PUT (actualizar: permiso de módulo + validación) ────────

export async function PUT(request: Request) {
    try {
        const access = await requireModule();
        if ('error' in access) return access.error;

        const rawBody = await request.json().catch(() => null);
        const parsed = productoUpdateSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', detalles: formatZodErrors(parsed.error) },
                { status: 400 }
            );
        }
        const { id, nombre, parametros } = parsed.data;

        const supabase = createServiceClient();

        // Actualización + reemplazo de parámetros ATÓMICO vía RPC transaccional
        // (update nombre + delete + insert en una sola transacción).
        // ⚠️ REQUIERE migración 20260624000002_rpc_productos_transaccional.sql
        //    aplicada en la BD; sin ella, esta ruta responderá error.
        const { data: producto, error } = await supabase.rpc('reemplazar_producto_parametros', {
            p_id: id,
            p_nombre: nombre,
            p_parametros: parametros.map(paramToJson),
        });
        if (error) throw error;

        return NextResponse.json(producto);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

// ─── DELETE (borrar: permiso de módulo + validación) ─────────

export async function DELETE(request: Request) {
    try {
        const access = await requireModule();
        if ('error' in access) return access.error;

        const rawBody = await request.json().catch(() => null);
        const parsed = idBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'ID inválido', detalles: formatZodErrors(parsed.error) },
                { status: 400 }
            );
        }

        const supabase = createServiceClient();
        const { error } = await supabase.from('productos').delete().eq('id', parsed.data.id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
