import { NextResponse } from 'next/server';
import { getAuthUserId, getAuthProfile } from '@/lib/api/withAuth';
import { createServiceClient } from '@/lib/supabase/admin-client';
import { userHasModule } from '@/lib/api/permissions';
import {
    parametroMaestroUpsertSchema,
    idBodySchema,
    formatZodErrors,
} from '@/lib/schemas';

const MODULE_KEY = 'parametros-maestros';

/**
 * Sesión + permiso del módulo `parametros-maestros` (para mutaciones).
 */
async function requireModule() {
    // Perfil + permisos en una sola query a usuarios (getAuthProfile)
    const user = await getAuthProfile();
    if (!user) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }

    if (!(await userHasModule(user, MODULE_KEY))) {
        return {
            error: NextResponse.json(
                { error: 'No autorizado. Se requiere permiso del módulo de parámetros maestros.' },
                { status: 403 }
            ),
        };
    }
    return { user };
}

// ─── GET (lectura: solo sesión) ──────────────────────────────

export async function GET(request: Request) {
    try {
        const auth = await getAuthUserId();
        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const supabase = createServiceClient();

        if (type === 'locales') {
            // Parámetros locales (parametro_maestro_id IS NULL), agrupados por
            // nombre+tipo para sugerir candidatos a estandarización.
            const { data, error } = await supabase
                .from('parametros')
                .select('nombre, tipo, producto_id, productos(nombre)')
                .is('parametro_maestro_id', null);

            if (error) throw error;

            const grouped = data.reduce((acc: any, curr: any) => {
                const key = `${curr.nombre.toLowerCase()}-${curr.tipo}`;
                if (!acc[key]) {
                    acc[key] = { nombre: curr.nombre, tipo: curr.tipo, frecuencia: 0, productos: [] };
                }
                acc[key].frecuencia += 1;
                if (curr.productos?.nombre) {
                    acc[key].productos.push(curr.productos.nombre);
                }
                return acc;
            }, {});

            return NextResponse.json(Object.values(grouped));
        }

        const { data, error } = await supabase
            .from('parametros_maestros')
            .select('*')
            .order('id', { ascending: true });

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
        const parsed = parametroMaestroUpsertSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', detalles: formatZodErrors(parsed.error) },
                { status: 400 }
            );
        }

        const supabase = createServiceClient();
        // Solo campos validados (nombre, tipo) → cierra el mass-assignment.
        const { data, error } = await supabase
            .from('parametros_maestros')
            .insert({ nombre: parsed.data.nombre, tipo: parsed.data.tipo })
            .select()
            .single();
        if (error) throw error;

        return NextResponse.json(data);
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
        // id + (nombre, tipo) validados por separado.
        const idParsed = idBodySchema.safeParse(rawBody);
        const fieldsParsed = parametroMaestroUpsertSchema.safeParse(rawBody);
        if (!idParsed.success || !fieldsParsed.success) {
            const detalles = {
                ...(idParsed.success ? {} : formatZodErrors(idParsed.error)),
                ...(fieldsParsed.success ? {} : formatZodErrors(fieldsParsed.error)),
            };
            return NextResponse.json({ error: 'Datos inválidos', detalles }, { status: 400 });
        }

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('parametros_maestros')
            .update({ nombre: fieldsParsed.data.nombre, tipo: fieldsParsed.data.tipo })
            .eq('id', idParsed.data.id)
            .select()
            .single();
        if (error) throw error;

        return NextResponse.json(data);
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
        const { error } = await supabase
            .from('parametros_maestros')
            .delete()
            .eq('id', parsed.data.id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
