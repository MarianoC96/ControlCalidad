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

        const [evalsCalidad, evalsEscaneo] = await Promise.all([
            supabase
                .from('edit_requests')
                .select(`
                    id, registro_id, status, motivo, created_at, resolved_at,
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
                `),
            supabase
                .from('edit_requests_escaneo')
                .select(`
                    id, historial_id, scan_mode, status, motivo, created_at, updated_at,
                    usuarios!edit_requests_escaneo_usuario_id_fkey(nombre_completo, usuario),
                    admin:usuarios!edit_requests_escaneo_admin_id_fkey(nombre_completo, usuario)
                `)
        ]);

        if (evalsCalidad.error) throw evalsCalidad.error;
        if (evalsEscaneo.error) throw evalsEscaneo.error;

        const mappedCalidad = evalsCalidad.data.map((req: any) => ({
            ...req,
            origen: 'calidad',
            id_real: req.id, // Para el tracking de ID unico en array
        }));

        const rawEscaneo = evalsEscaneo.data || [];
        const mappedEscaneoResponse = await Promise.all(rawEscaneo.map(async (req: any) => {
            const table = req.scan_mode === 'productos' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';
            const { data: hist } = await supabase
                .from(table)
                .select('barcode, lote, created_at')
                .eq('id', req.historial_id)
                .single();
            
            // Replicamos la estructura del JSON para que SolicitudesClient.tsx lo procese nativamente sin crashear
            return {
                id: req.id, // Ojo usamos el ID original, el PUT se fijará en 'origen'
                origen: 'escaneo',
                scan_mode: req.scan_mode,
                registro_id: req.historial_id, // Falseamos registro_id para el frontend
                status: req.status,
                motivo: req.motivo,
                created_at: req.created_at,
                resolved_at: req.updated_at, // En escaneo usamos updated_at
                registros: {
                    lote_interno: hist?.lote || 'Desconocido',
                    producto_nombre: req.scan_mode === 'productos' ? 'Producto En Escáner' : 'Caja En Escáner',
                    fecha_registro: hist?.created_at || req.created_at
                },
                usuarios: req.usuarios,
                resuelto_por: req.admin
            };
        }));

        const unifiedList = [...mappedCalidad, ...mappedEscaneoResponse]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json(unifiedList);

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
        const { id, status, origen } = body; // Añadimos 'origen' (param) para distinguir

        if (!id || !['aprobado', 'rechazado'].includes(status)) {
            return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Check if user has access to solicitudes module (Role Check)
        const { data: user } = await supabase
            .from('usuarios')
            .select('id, usuario, roles, role_id')
            .eq('id', parseInt(userId))
            .single();

        if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });

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

        if (!hasAccess) return NextResponse.json({ error: 'No tienes permisos para gestionar solicitudes' }, { status: 403 });

        if (origen === 'escaneo') {
            // Update Escaneo Table
            const { error } = await supabase
                .from('edit_requests_escaneo')
                .update({
                    status,
                    admin_id: parseInt(userId),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
            if (error) throw error;

            return NextResponse.json({ success: true });
        } else {
            // Update Calidad Table Default
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
        }

    } catch (error: any) {
        console.error('Error updating edit request:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
