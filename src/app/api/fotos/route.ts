import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, getAuthProfile } from '@/lib/api/withAuth';
import { createServiceClient } from '@/lib/supabase/admin-client';
import { userHasModule } from '@/lib/api/permissions';

/** Máximo de fotos por registro (coherente con /api/registros/edit). */
const MAX_FOTOS_POR_REGISTRO = 2;

/** Tamaño máximo de imagen (bytes decodificados): ~2 MB. */
const MAX_FOTO_BYTES = 2 * 1024 * 1024;

/** Data URL de imagen permitida. */
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,/i;

/**
 * Estima los bytes decodificados de un data URL base64 sin materializar el
 * buffer (rápido y suficiente para validar el límite de tamaño).
 */
function estimateBase64Bytes(dataUrl: string): number {
    const commaIdx = dataUrl.indexOf(',');
    const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - padding;
}

// ─── POST: subir foto (pertenencia + lock + tamaño + tipo + nº) ───

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUserId();
        if (!auth) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        const userId = parseInt(auth.userId, 10);

        const body = await request.json().catch(() => null);
        const registroId = body?.registro_id;
        const datosBase64 = body?.datos_base64;
        const descripcion = body?.descripcion;

        if (!registroId || !datosBase64) {
            return NextResponse.json(
                { error: 'registro_id y datos_base64 son requeridos' },
                { status: 400 }
            );
        }

        // Validar que sea una imagen base64 admitida
        if (typeof datosBase64 !== 'string' || !IMAGE_DATA_URL_RE.test(datosBase64)) {
            return NextResponse.json(
                { error: 'datos_base64 debe ser una imagen (png, jpg o webp) en formato data URL base64' },
                { status: 400 }
            );
        }

        // Validar tamaño
        if (estimateBase64Bytes(datosBase64) > MAX_FOTO_BYTES) {
            return NextResponse.json(
                { error: 'La imagen excede el tamaño máximo permitido (2 MB).' },
                { status: 413 }
            );
        }

        const supabase = createServiceClient();

        // Cargar registro + fotos actuales para validar pertenencia/lock/cupo
        const { data: registro, error: regError } = await supabase
            .from('registros')
            .select('id, edit_started_by, edit_expires_at, fotos(id)')
            .eq('id', registroId)
            .single();

        if (regError || !registro) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        // Requiere lock de edición activo y propiedad del lock por este usuario.
        const now = new Date();
        const expiresAt = registro.edit_expires_at ? new Date(registro.edit_expires_at) : null;
        const lockActivo = !!expiresAt && expiresAt > now;
        const lockEsMio = registro.edit_started_by === userId;

        if (!lockActivo || !lockEsMio) {
            return NextResponse.json(
                { error: 'Debes tener un bloqueo de edición activo sobre este registro para agregar fotos.' },
                { status: 409 }
            );
        }

        // Cupo máximo de fotos
        const fotosActuales = Array.isArray(registro.fotos) ? registro.fotos.length : 0;
        if (fotosActuales >= MAX_FOTOS_POR_REGISTRO) {
            return NextResponse.json(
                { error: `Límite de fotos alcanzado. Máximo ${MAX_FOTOS_POR_REGISTRO} por registro.` },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('fotos')
            .insert({
                registro_id: registroId,
                datos_base64: datosBase64,
                descripcion: descripcion || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error uploading photo:', error);
            return NextResponse.json({ error: 'Error al guardar la foto' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Unexpected error uploading photo:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// ─── GET: fotos de un registro (requiere sesión) ─────────────

export async function GET(request: NextRequest) {
    const auth = await getAuthUserId();
    if (!auth) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const registroId = searchParams.get('registro_id');

    if (!registroId) {
        return NextResponse.json({ error: 'registro_id es requerido' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
        .from('fotos')
        .select('*')
        .eq('registro_id', registroId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching photos:', error);
        return NextResponse.json({ error: 'Error al obtener las fotos' }, { status: 500 });
    }

    return NextResponse.json(data);
}

// ─── DELETE: borrar foto (permiso unificado por role_permisos) ───

export async function DELETE(request: NextRequest) {
    try {
        // Perfil + permisos en una sola query a usuarios (getAuthProfile)
        const user = await getAuthProfile();
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        // Criterio unificado con el resto del sistema (sadmin / role_permisos /
        // fallback legacy), en lugar del antiguo `roles === 'administrador'`.
        // Las fotos forman parte del flujo de edición ⇒ módulo 'solicitudes'.
        if (!(await userHasModule(user, 'solicitudes'))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const supabase = createServiceClient();
        const { error } = await supabase.from('fotos').delete().eq('id', id);

        if (error) {
            console.error('Error deleting photo:', error);
            return NextResponse.json({ error: 'Error al eliminar la foto' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
