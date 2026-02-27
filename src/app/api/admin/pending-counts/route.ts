import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
const createAdminClient = () => createServiceClient();

export async function GET() {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ pendingSolicitudes: 0 });
        }

        const supabase = createAdminClient();

        // Run user fetch and pending count in parallel
        const [userResult, countResult] = await Promise.all([
            supabase
                .from('usuarios')
                .select('id, usuario, roles, role_id')
                .eq('id', parseInt(userId))
                .single(),
            supabase
                .from('edit_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pendiente')
        ]);

        const user = userResult.data;
        if (!user) {
            return NextResponse.json({ pendingSolicitudes: 0 });
        }

        // Determine if user has access to the "solicitudes" module
        let hasAccessToSolicitudes = false;

        if (user.usuario === 'sadmin') {
            hasAccessToSolicitudes = true;
        } else if (!user.role_id) {
            hasAccessToSolicitudes = user.roles === 'administrador';
        } else {
            const { data: permisos } = await supabase
                .from('role_permisos')
                .select('modulo_key')
                .eq('role_id', user.role_id)
                .eq('habilitado', true)
                .eq('modulo_key', 'solicitudes');

            hasAccessToSolicitudes = !!(permisos && permisos.length > 0);
        }

        if (!hasAccessToSolicitudes) {
            return NextResponse.json({ pendingSolicitudes: 0 });
        }

        if (countResult.error) throw countResult.error;

        return NextResponse.json({
            pendingSolicitudes: countResult.count || 0
        });

    } catch (error: any) {
        console.error('Error fetching pending counts:', error);
        return NextResponse.json({ pendingSolicitudes: 0 });
    }
}
