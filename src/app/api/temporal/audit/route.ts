import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
};

// GET - List audit log entries
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createAdminClient();

        // Verify the user has auditoria permission
        const { data: user } = await supabase
            .from('usuarios')
            .select('id, usuario, role_id')
            .eq('id', parseInt(userId))
            .single();

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        // sadmin always has access
        if (user.usuario !== 'sadmin') {
            if (!user.role_id) {
                return NextResponse.json({ error: 'No tienes permisos para auditoría' }, { status: 403 });
            }

            const { data: perm } = await supabase
                .from('role_permisos')
                .select('habilitado')
                .eq('role_id', user.role_id)
                .eq('modulo_key', 'auditoria')
                .single();

            if (!perm?.habilitado) {
                return NextResponse.json({ error: 'No tienes permisos para auditoría' }, { status: 403 });
            }
        }

        const { searchParams } = new URL(request.url);
        const showResolved = searchParams.get('resolved') === 'true';

        let query = supabase
            .from('auditoria_temporal')
            .select('*')
            .order('created_at', { ascending: false });

        if (!showResolved) {
            query = query.eq('resuelto', false);
        }

        const { data: auditLogs, error } = await query.limit(100);

        if (error) {
            console.error('Error fetching audit logs:', error);
            return NextResponse.json({ error: 'Error al obtener auditoría' }, { status: 500 });
        }

        // Also get pending temporal records
        const { data: pendingRecords } = await supabase
            .from('registros_temporales')
            .select('*')
            .eq('estado', 'pendiente_validacion')
            .order('fecha_sincronizacion', { ascending: false });

        return NextResponse.json({
            auditLogs: auditLogs || [],
            pendingRecords: pendingRecords || [],
        });
    } catch (error) {
        console.error('Audit API error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT - Resolve/validate a pending record
export async function PUT(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createAdminClient();
        const currentUserId = parseInt(userId);

        // Verify the user has auditoria permission
        const { data: user } = await supabase
            .from('usuarios')
            .select('id, usuario, role_id')
            .eq('id', currentUserId)
            .single();

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        if (user.usuario !== 'sadmin') {
            if (!user.role_id) {
                return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 });
            }

            const { data: perm } = await supabase
                .from('role_permisos')
                .select('habilitado')
                .eq('role_id', user.role_id)
                .eq('modulo_key', 'auditoria')
                .single();

            if (!perm?.habilitado) {
                return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 });
            }
        }

        const { registroId, auditId, action } = await request.json();

        if (!registroId || !action || !['validado', 'rechazado'].includes(action)) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        // Update the temporal record status
        const { error: updateError } = await supabase
            .from('registros_temporales')
            .update({ estado: action })
            .eq('id', registroId);

        if (updateError) {
            console.error('Error updating record:', updateError);
            return NextResponse.json({ error: 'Error al actualizar registro' }, { status: 500 });
        }

        // Mark audit entry as resolved
        if (auditId) {
            await supabase
                .from('auditoria_temporal')
                .update({
                    resuelto: true,
                    resuelto_por: currentUserId,
                    resuelto_at: new Date().toISOString(),
                })
                .eq('id', auditId);
        }

        // Log the validation action
        await supabase
            .from('auditoria_temporal')
            .insert({
                registro_temporal_id: registroId,
                tipo_evento: 'validacion',
                usuario_offline_id: currentUserId,
                usuario_sync_id: currentUserId,
                mensaje: `Registro ${action === 'validado' ? 'VALIDADO' : 'RECHAZADO'} por usuario ID ${currentUserId}.`,
                datos_extra: { action },
            });

        return NextResponse.json({ success: true, action });
    } catch (error) {
        console.error('Audit PUT error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
