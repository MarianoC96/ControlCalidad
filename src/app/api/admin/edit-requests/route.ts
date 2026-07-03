import { NextResponse } from 'next/server';
import { getAuthProfile, createServiceClient } from '@/lib/api/withAuth';
import { userHasModule } from '@/lib/api/permissions';
// Helper Service Role Client
const createAdminClient = () => createServiceClient();

// Tope defensivo por fuente: la vista de solicitudes no pagina, pero sin
// límite el select trae la tabla entera a medida que crece el histórico.
const MAX_REQUESTS_PER_SOURCE = 200;

export async function GET() {
    try {
        // Perfil + permisos en una sola query a usuarios (getAuthProfile)
        const user = await getAuthProfile();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        if (!(await userHasModule(user, 'solicitudes'))) {
            return NextResponse.json({ error: 'No tienes permisos de administrador para este módulo' }, { status: 403 });
        }

        const supabase = createAdminClient();

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
                `)
                .order('created_at', { ascending: false })
                .limit(MAX_REQUESTS_PER_SOURCE),
            supabase
                .from('edit_requests_escaneo')
                .select(`
                    id, historial_id, scan_mode, status, motivo, created_at, updated_at,
                    usuarios!edit_requests_escaneo_usuario_id_fkey(nombre_completo, usuario),
                    admin:usuarios!edit_requests_escaneo_admin_id_fkey(nombre_completo, usuario)
                `)
                .order('created_at', { ascending: false })
                .limit(MAX_REQUESTS_PER_SOURCE)
        ]);

        if (evalsCalidad.error) throw evalsCalidad.error;
        if (evalsEscaneo.error) throw evalsEscaneo.error;

        const mappedCalidad = evalsCalidad.data.map((req: any) => ({
            ...req,
            origen: 'calidad',
            id_real: req.id, // Para el tracking de ID unico en array
        }));

        const rawEscaneo = evalsEscaneo.data || [];

        // Resolver los historiales en 2 queries (una por tabla) en vez de una
        // por solicitud (N+1): agrupar ids por scan_mode y armar un mapa.
        const idsProductos = rawEscaneo
            .filter((r: any) => r.scan_mode === 'productos')
            .map((r: any) => r.historial_id);
        const idsCajas = rawEscaneo
            .filter((r: any) => r.scan_mode !== 'productos')
            .map((r: any) => r.historial_id);

        const [histProductos, histCajas] = await Promise.all([
            idsProductos.length
                ? supabase.from('historial_escaneos_productos').select('id, barcode, lote, created_at').in('id', idsProductos)
                : Promise.resolve({ data: [] as any[] }),
            idsCajas.length
                ? supabase.from('historial_escaneos_cajas').select('id, barcode, lote, created_at').in('id', idsCajas)
                : Promise.resolve({ data: [] as any[] }),
        ]);

        const histByKey = new Map<string, any>();
        for (const h of histProductos.data || []) histByKey.set(`productos:${h.id}`, h);
        for (const h of histCajas.data || []) histByKey.set(`cajas:${h.id}`, h);

        const mappedEscaneoResponse = rawEscaneo.map((req: any) => {
            const hist = histByKey.get(
                `${req.scan_mode === 'productos' ? 'productos' : 'cajas'}:${req.historial_id}`
            );

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
        });

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
        // Perfil + permisos en una sola query a usuarios (getAuthProfile)
        const user = await getAuthProfile();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        if (!(await userHasModule(user, 'solicitudes'))) {
            return NextResponse.json({ error: 'No tienes permisos para gestionar solicitudes' }, { status: 403 });
        }

        const body = await request.json();
        const { id, status, origen } = body; // Añadimos 'origen' (param) para distinguir

        if (!id || !['aprobado', 'rechazado'].includes(status)) {
            return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
        }

        const supabase = createAdminClient();

        if (origen === 'escaneo') {
            // Update Escaneo Table
            const { error } = await supabase
                .from('edit_requests_escaneo')
                .update({
                    status,
                    admin_id: user.id,
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
                    resolved_by: user.id
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
