import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { registro_id, password } = body;

        if (!registro_id) {
            return NextResponse.json({ error: 'ID de registro requerido' }, { status: 400 });
        }

        // Service Role Client to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch User and Role
        const { data: user, error: userError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', parseInt(userId))
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const isWorker = user.roles === 'trabajador';
        const isAdmin = user.roles === 'administrador';

        // Fetch Registro Current State
        const { data: registro, error: regError } = await supabase
            .from('registros')
            // Join with user to get name of current locker
            .select('*, usuarios!edit_started_by(nombre_completo)')
            .eq('id', registro_id)
            .single();

        if (regError || !registro) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        // Lock Logic
        const now = new Date();
        const expiresAt = registro.edit_expires_at ? new Date(registro.edit_expires_at) : null;

        // Active Lock Check
        // Locked if expiry is in future AND started_by is NOT null
        const isLocked = expiresAt && expiresAt > now && registro.edit_started_by;
        const isLockedByMe = isLocked && registro.edit_started_by === user.id;
        const isLockedByOther = isLocked && registro.edit_started_by !== user.id;

        if (isLockedByOther) {
            const lockerName = registro.usuarios?.nombre_completo || 'otro usuario';
            return NextResponse.json(
                { error: `Registro está siendo editado por ${lockerName} hasta las ${expiresAt?.toLocaleTimeString()}` },
                { status: 409 }
            );
        }

        // Worker Restrictions
        if (isWorker) {
            // Check if already edited by ANY worker (including self)
            const { count } = await supabase
                .from('history_edits')
                .select('*', { count: 'exact', head: true })
                .eq('registro_id', registro_id)
                .eq('role', 'trabajador');

            if (count !== null && count > 0) {
                return NextResponse.json(
                    { error: 'Este registro ya fue editado por un trabajador. Solo un administrador puede realizar más cambios.' },
                    { status: 403 }
                );
            }

            // Check if previously locked by me but expired (Time limit exceeded)
            // If I was the last starter, but time expired, I am blocked.
            if (registro.edit_started_by === user.id && expiresAt && expiresAt <= now) {
                return NextResponse.json(
                    { error: 'El tiempo de edición ha expirado. Solo un administrador puede reactivar la edición.' },
                    { status: 403 }
                );
            }
        }

        // Admin Re-Auth
        if (isAdmin) {
            // Admins can override expired locks or their own locks, but need password
            // If locked by other (active), they are blocked above (Concurrency).
            // So here we handle: New lock, or Resuming/Overriding own/expired lock.

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
        let newExpiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        let newStartedAt = now.toISOString();

        // If resuming active lock (by me), keep original times to enforce original 1 hour limit
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
