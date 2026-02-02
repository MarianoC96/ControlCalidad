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
        const { registro_id, photos, password } = body;

        if (!registro_id || !photos) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch User
        const { data: user } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', parseInt(userId))
            .single();

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const isWorker = user.roles === 'trabajador';
        const isAdmin = user.roles === 'administrador';

        // Check Admin Password
        if (isAdmin) {
            if (!password) {
                return NextResponse.json({ error: 'Contraseña requerida', requirePassword: true }, { status: 401 });
            }
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
            }
        }

        // Fetch Registro Details (Lock & Existing Photos)
        const { data: registro, error: regError } = await supabase
            .from('registros')
            .select('*, fotos(*)')
            .eq('id', registro_id)
            .single();

        if (regError || !registro) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        // Validate Lock
        // Must be locked by current user (unless admin overrides, but admin still needs to "Start Edit/Lock" first, theoretically)
        // User flow: Click Edit -> Request Lock -> Success -> Open Modal -> Save.
        // So at Save time, it SHOULD be locked by user.
        // If expired?
        // Worker: Fail.
        // Admin: Allow (override).

        if (registro.edit_started_by !== user.id) {
            return NextResponse.json({ error: 'No tienes el bloqueo de edición de este registro.' }, { status: 403 });
        }

        const now = new Date();
        const expiresAt = registro.edit_expires_at ? new Date(registro.edit_expires_at) : null;
        const isExpired = expiresAt && expiresAt < now;

        if (isWorker && isExpired) {
            return NextResponse.json({ error: 'El tiempo de edición ha expirado.' }, { status: 403 });
        }

        // Validate Worker Logic (One Edit Rule)
        if (isWorker) {
            const { count } = await supabase
                .from('history_edits')
                .select('*', { count: 'exact', head: true })
                .eq('registro_id', registro_id)
                .eq('role', 'trabajador');

            if (count !== null && count > 0) {
                return NextResponse.json({ error: 'Ya realizaste una edición previa en este registro.' }, { status: 403 });
            }
        }

        // Validate Max Photos
        // "Máximo 2 fotos por registro" -> Total photos for registry <= 2.
        const currentPhotosCount = registro.fotos ? registro.fotos.length : 0;
        const newPhotosCount = photos.length;

        if (currentPhotosCount + newPhotosCount > 2) {
            return NextResponse.json(
                { error: `Límite de fotos excedido. El registro tiene ${currentPhotosCount} y intentas agregar ${newPhotosCount}. Máximo total: 2.` },
                { status: 400 }
            );
        }

        // Perform Save

        // 1. Log History
        const { error: historyError } = await supabase
            .from('history_edits')
            .insert({
                registro_id: registro_id,
                edited_by: user.id,
                role: user.roles,
                action: 'add_photo',
                photos_added: photos // Store metadata/base64 previews if needed, or just count/names
            });

        if (historyError) {
            return NextResponse.json({ error: 'Error al registrar historial' }, { status: 500 });
        }

        // 2. Insert Photos
        for (const photo of photos) {
            const { error: photoError } = await supabase
                .from('fotos')
                .insert({
                    registro_id: registro_id,
                    datos_base64: photo.data, // content
                    descripcion: photo.description || 'Foto agregada en edición'
                });

            if (photoError) {
                console.error('Error saving photo', photoError);
                // Should probably rollback or partial fail?
                // For now continue
            }
        }

        // 3. Clear Lock
        await supabase
            .from('registros')
            .update({
                edit_started_at: null,
                edit_expires_at: null,
                edit_started_by: null
            })
            .eq('id', registro_id);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Edit save error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
