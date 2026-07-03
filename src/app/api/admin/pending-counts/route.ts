import { NextResponse } from 'next/server';
import { getAuthProfile, createServiceClient } from '@/lib/api/withAuth';
import { userHasModule } from '@/lib/api/permissions';
const createAdminClient = () => createServiceClient();

export async function GET() {
    try {
        const supabase = createAdminClient();

        // Perfil (una query a usuarios) y conteo en paralelo
        const [user, countResult] = await Promise.all([
            getAuthProfile(),
            supabase
                .from('edit_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pendiente')
        ]);

        // Criterio unificado de autorización (sadmin / role_permisos)
        if (!user || !(await userHasModule(user, 'solicitudes'))) {
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
