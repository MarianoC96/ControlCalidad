import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import { verifyUserPassword } from '@/lib/api/reauth';

export async function POST(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { historial_id, scan_mode, password } = body;

        if (!historial_id || !scan_mode) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        const supabase = createServiceClient();
        const table = scan_mode === 'productos' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';

        // Fetch User and Registro
        const [userResult, regResult] = await Promise.all([
            supabase.from('usuarios').select('id, usuario, roles, role_id').eq('id', parseInt(userId)).single(),
            supabase.from(table).select('id, edit_started_at, edit_expires_at, edit_started_by, usuarios!edit_started_by(nombre_completo)').eq('id', historial_id).single()
        ]);

        const { data: user, error: userError } = userResult;
        const { data: registro, error: regError } = regResult;

        if (userError || !user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        
        // Exponer error exacto de SQL para debugging
        if (regError) return NextResponse.json({ error: 'Falta ejecutar SQL en Supabase: ' + regError.message }, { status: 500 });
        if (!registro) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

        const now = new Date();
        const expiresAt = registro.edit_expires_at ? new Date(registro.edit_expires_at) : null;
        const isLocked = expiresAt && expiresAt > now && registro.edit_started_by;
        const isLockedByMe = isLocked && registro.edit_started_by === user.id;
        const isLockedByOther = isLocked && registro.edit_started_by !== user.id;

        if (isLockedByOther) {
            const lockerName = (registro as any).usuarios?.nombre_completo || 'otro usuario';
            return NextResponse.json({ error: `Editándose por ${lockerName} hasta ${expiresAt?.toLocaleTimeString()}` }, { status: 409 });
        }

        let hasDirectEditPermission = false;
        if (user.usuario === 'sadmin' || user.roles === 'administrador') {
            hasDirectEditPermission = true;
        } else if (user.role_id) {
            const { data: permisos } = await supabase
                .from('role_permisos')
                .select('modulo_key')
                .eq('role_id', user.role_id)
                .eq('habilitado', true)
                .eq('modulo_key', 'solicitudes'); // Using same permission key for now as requested
            hasDirectEditPermission = !!(permisos && permisos.length > 0);
        }

        if (!hasDirectEditPermission) {
            const [approvedResult] = await Promise.all([
                supabase
                    .from('edit_requests_escaneo')
                    .select('id')
                    .eq('historial_id', historial_id)
                    .eq('scan_mode', scan_mode)
                    .eq('usuario_id', user.id)
                    .eq('status', 'aprobado')
                    .limit(1)
            ]);

            const hasApprovedRequest = approvedResult.data && approvedResult.data.length > 0;

            if (!hasApprovedRequest && !isLockedByMe) {
                return NextResponse.json({
                    error: 'Debe pedir solicitud de edición primero.',
                    canRequest: true
                }, { status: 403 });
            }
        }

        if (hasDirectEditPermission) {
            if (!password) {
                return NextResponse.json({ error: 'Contraseña requerida', requirePassword: true }, { status: 401 });
            }
            const match = await verifyUserPassword(user.usuario, password);
            if (!match) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
        }

        let newExpiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        let newStartedAt = now.toISOString();

        if (isLockedByMe) {
            newExpiresAt = expiresAt!;
            newStartedAt = registro.edit_started_at;
        }

        const { error: updateError } = await supabase
            .from(table)
            .update({
                edit_started_at: newStartedAt,
                edit_expires_at: newExpiresAt.toISOString(),
                edit_started_by: user.id
            })
            .eq('id', historial_id);

        if (updateError) return NextResponse.json({ error: 'Error al aplicar bloqueo' }, { status: 500 });

        return NextResponse.json({ success: true, expiresAt: newExpiresAt.toISOString(), startedAt: newStartedAt });
    } catch (error) {
        console.error('Lock error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
