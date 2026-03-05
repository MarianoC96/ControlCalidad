import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
// Helper Service Role Client
const createAdminClient = () => createServiceClient();

export async function GET() {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createAdminClient();

        const { data: user } = await supabase
            .from('usuarios')
            .select('id, usuario, roles, role_id')
            .eq('id', parseInt(userId))
            .single();

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
        }

        // Check Access (Shared with PUT)
        let hasAccess = false;
        if (user.usuario === 'sadmin') {
            hasAccess = true;
        } else if (user.roles === 'administrador') {
            hasAccess = true;
        } else if (user.role_id) {
            const { data: permisos } = await supabase
                .from('role_permisos')
                .select('modulo_key')
                .eq('role_id', user.role_id)
                .eq('habilitado', true)
                .eq('modulo_key', 'solicitudes');
            hasAccess = !!(permisos && permisos.length > 0);
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'No tienes permisos de administrador para este módulo' }, { status: 403 });
        }

        const requestsResult = await supabase
            .from('edit_requests')
            .select(`
                id, status, motivo, created_at, resolved_at,
                registros (
                    lote_interno,
                    producto_nombre,
                    fecha_registro
                ),
                usuarios!usuario_id (
                    nombre_completo,
                    usuario
                ),
                resuelto_por:usuarios!resolved_by (
                    nombre_completo,
                    usuario
                )
            `)
            .order('created_at', { ascending: false });

        if (requestsResult.error) throw requestsResult.error;


        return NextResponse.json(requestsResult.data);

    } catch (error: any) {
        console.error('Error fetching edit requests:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { id, status } = body; // 'aprobado' or 'rechazado'

        if (!id || !['aprobado', 'rechazado'].includes(status)) {
            return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Verify if user has access to solicitudes module
        const { data: user } = await supabase
            .from('usuarios')
            .select('id, usuario, roles, role_id')
            .eq('id', parseInt(userId))
            .single();

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
        }

        // Check access to solicitudes
        let hasAccess = false;
        if (user.usuario === 'sadmin') {
            hasAccess = true;
        } else if (!user.role_id) {
            hasAccess = user.roles === 'administrador';
        } else {
            const { data: permisos } = await supabase
                .from('role_permisos')
                .select('modulo_key')
                .eq('role_id', user.role_id)
                .eq('habilitado', true)
                .eq('modulo_key', 'solicitudes');
            hasAccess = !!(permisos && permisos.length > 0);
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'No tienes permisos para gestionar solicitudes' }, { status: 403 });
        }

        const { error } = await supabase
            .from('edit_requests')
            .update({
                status,
                resolved_at: new Date().toISOString(),
                resolved_by: parseInt(userId)
            })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error updating edit request:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
