import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { registro_id, password } = body;

        if (!registro_id) {
            return NextResponse.json({ error: 'ID de registro requerido' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Fetch User and Registro in PARALLEL (instead of sequential)
        const [userResult, regResult] = await Promise.all([
            supabase
                .from('usuarios')
                .select('id, usuario, roles, password')
                .eq('id', parseInt(userId))
                .single(),
            supabase
                .from('registros')
                .select('id, edit_started_at, edit_expires_at, edit_started_by, usuarios!edit_started_by(nombre_completo)')
                .eq('id', registro_id)
                .single()
        ]);

        const { data: user, error: userError } = userResult;
        const { data: registro, error: regError } = regResult;

        if (userError || !user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        if (regError || !registro) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        const isWorker = user.roles === 'trabajador';
        const isAdmin = user.roles === 'administrador';

        // Lock Logic
        const now = new Date();
        const expiresAt = registro.edit_expires_at ? new Date(registro.edit_expires_at) : null;

        // Active Lock Check
        const isLocked = expiresAt && expiresAt > now && registro.edit_started_by;
        const isLockedByMe = isLocked && registro.edit_started_by === user.id;
        const isLockedByOther = isLocked && registro.edit_started_by !== user.id;

        if (isLockedByOther) {
            const lockerName = (registro as any).usuarios?.nombre_completo || 'otro usuario';
            return NextResponse.json(
                { error: `Registro está siendo editado por ${lockerName} hasta las ${expiresAt?.toLocaleTimeString()}` },
                { status: 409 }
            );
        }

        // Worker Restrictions
        if (isWorker) {
            // Run both checks in parallel
            const [approvedResult, historyResult] = await Promise.all([
                supabase
                    .from('edit_requests')
                    .select('id', { count: 'exact', head: false })
                    .eq('registro_id', registro_id)
                    .eq('usuario_id', user.id)
                    .eq('status', 'aprobado')
                    .limit(1),
                supabase
                    .from('history_edits')
                    .select('id', { count: 'exact', head: true })
                    .eq('registro_id', registro_id)
                    .eq('role', 'trabajador')
            ]);

            const hasApprovedRequest = approvedResult.data && approvedResult.data.length > 0;

            if (!hasApprovedRequest) {
                const editCount = historyResult.count;

                if (editCount !== null && editCount > 0) {
                    return NextResponse.json(
                        {
                            error: 'Este registro ya fue editado por un trabajador. Solo un administrador puede realizar más cambios.',
                            canRequest: true
                        },
                        { status: 403 }
                    );
                }

                // Check if previously locked by me but expired
                if (registro.edit_started_by === user.id && expiresAt && expiresAt <= now) {
                    return NextResponse.json(
                        {
                            error: 'El tiempo de edición ha expirado. Solo un administrador puede reactivar la edición.',
                            canRequest: true
                        },
                        { status: 403 }
                    );
                }
            }
        }

        // Admin Re-Auth
        if (isAdmin) {
            if (!password) {
                return NextResponse.json(
                    { error: 'Contraseña requerida para editar como administrador', requirePassword: true },
                    { status: 401 }
                );
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return NextResponse.json(
                    { error: 'Contraseña incorrecta' },
                    { status: 401 }
                );
            }
        }

        // Apply/Refresh Lock
        let newExpiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        let newStartedAt = now.toISOString();

        if (isLockedByMe) {
            newExpiresAt = expiresAt!;
            newStartedAt = registro.edit_started_at;
        }

        const { error: updateError } = await supabase
            .from('registros')
            .update({
                edit_started_at: newStartedAt,
                edit_expires_at: newExpiresAt.toISOString(),
                edit_started_by: user.id
            })
            .eq('id', registro_id);

        if (updateError) {
            return NextResponse.json({ error: 'Error al aplicar bloqueo' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            expiresAt: newExpiresAt.toISOString(),
            startedAt: newStartedAt
        });

    } catch (error) {
        console.error('Lock error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
