import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api/withAuth';
import { createServiceClient } from '@/lib/supabase/admin-client';
import { getAppUserById, userHasModule } from '@/lib/api/permissions';
import { parametroMaestroUpsertSchema, formatZodErrors } from '@/lib/schemas';

export async function POST(request: Request) {
    try {
        const auth = await getAuthUserId();
        if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        // Permiso de módulo (mutación sobre el catálogo de parámetros maestros)
        const user = await getAppUserById(parseInt(auth.userId, 10));
        if (!user || !(await userHasModule(user, 'parametros-maestros'))) {
            return NextResponse.json(
                { error: 'No autorizado. Se requiere permiso del módulo de parámetros maestros.' },
                { status: 403 }
            );
        }

        const rawBody = await request.json().catch(() => null);
        const parsed = parametroMaestroUpsertSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', detalles: formatZodErrors(parsed.error) },
                { status: 400 }
            );
        }
        const { nombre, tipo } = parsed.data;

        const supabase = createServiceClient();

        // 1. Create the new Master Parameter
        const { data: maestro, error: maestroError } = await supabase
            .from('parametros_maestros')
            .insert({ nombre, tipo })
            .select()
            .single();

        if (maestroError) throw maestroError;

        // 2. Update all local parameters with the same name and type
        // We do a case-insensitive match for the name
        const { error: updateError } = await supabase
            .from('parametros')
            .update({ parametro_maestro_id: maestro.id })
            .is('parametro_maestro_id', null)
            .eq('tipo', tipo)
            .ilike('nombre', nombre);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            maestro,
            message: 'Parámetro estandarizado correctamente'
        });

    } catch (error: any) {
        console.error('Standardization error:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
