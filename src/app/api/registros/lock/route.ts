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

        // Fetch User and Registro in PARALLEL
        const [userResult, regResult] = await Promise.all([
            supabase
                .from('usuarios')
                .select('id, usuario, roles, password, role_id')
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

        // Base Variables for Lock Logic
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

        // 1. Check if user has direct edit permission (Only sadmin and those with 'solicitudes' module)
        let hasDirectEditPermission = false;

        if (user.usuario === 'sadmin' || user.roles === 'administrador') {
            hasDirectEditPermission = true;
        } else if (user.role_id) {

            const { data: permisos } = await supabase
                .from('role_permisos')
                .select('modulo_key')
                .eq('role_id', user.role_id)
                .eq('habilitado', true)
                .eq('modulo_key', 'solicitudes');

            hasDirectEditPermission = !!(permisos && permisos.length > 0);
        }


        // 2. Logic for those WITHOUT direct edit permission (must have approved request)
        if (!hasDirectEditPermission) {
            const [approvedResult] = await Promise.all([
                supabase
                    .from('edit_requests')
                    .select('id')
                    .eq('registro_id', registro_id)
                    .eq('usuario_id', user.id)
                    .eq('status', 'aprobado')
                    .limit(1)
            ]);

            const hasApprovedRequest = approvedResult.data && approvedResult.data.length > 0;

            // Rule: No direct permission AND no approved request AND no active lock = Must Request
            if (!hasApprovedRequest && !isLockedByMe) {
                return NextResponse.json(
                    {
                        error: 'Para realizar cambios en este registro debe enviar primero una solicitud de edición.',
                        canRequest: true
                    },
                    { status: 403 }
                );
            }
        }


        // 3. Direct edit or active lock re-auth requires password check
        if (hasDirectEditPermission) {
            if (!password) {
                return NextResponse.json(
                    { error: 'Contraseña requerida', requirePassword: true },
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

