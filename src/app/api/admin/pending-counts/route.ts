import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import { getAppUserById, userHasModule } from '@/lib/api/permissions';
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
        const [user, countResult] = await Promise.all([
            getAppUserById(parseInt(userId, 10)),
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
