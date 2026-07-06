import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createServiceClient } from '@/lib/api/withAuth';
import { verifyUserPassword } from '@/lib/api/reauth';

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthProfile();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { startDate, endDate, password } = await req.json();

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 });
        }

        // Re-auth por contraseña (misma vía que lock/edit/escáner): la descarga
        // masiva exporta el histórico completo del rango, así que exige
        // confirmar identidad, no solo tener una sesión abierta.
        if (!password) {
            return NextResponse.json(
                { error: 'Contraseña requerida', requirePassword: true },
                { status: 401 }
            );
        }
        const match = await verifyUserPassword(user.usuario, password);
        if (!match) {
            return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
        }

        // Use Service Role to bypass RLS since we handle auth via cookie ID
        const supabase = createServiceClient();

        // Create initial record
        const { data, error } = await supabase
            .from('download_history')
            .insert({
                user_id: user.id,
                start_date: startDate,
                end_date: endDate,
                status: 'pending',
                total_files: 0
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating download record:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e: any) {
        console.error("Create download error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
