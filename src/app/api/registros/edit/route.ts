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
        const {
            registro_id,
            photos = [],
            photosToDelete = [],
            password,
            // New field changes
            lote_interno,
            lote_producto,
            guia,
            marca,
            cantidad
        } = body;

        if (!registro_id) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        // Check if there are field changes
        const hasFieldChanges = lote_interno !== undefined || lote_producto !== undefined ||
            guia !== undefined || marca !== undefined || cantidad !== undefined;

        // Validate that there's something to do
        if (photos.length === 0 && photosToDelete.length === 0 && !hasFieldChanges) {
            return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Fetch User
        const { data: user } = await supabase
            .from('usuarios')
            .select('id, roles, password')
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
            .select('id, lote_interno, lote_producto, guia, marca, cantidad, edit_started_by, edit_expires_at, fotos(id)')
            .eq('id', registro_id)
            .single();

        if (regError || !registro) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        // Validate Lock
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
        let approvedRequestId = null;
        if (isWorker) {
            // Run both checks in parallel
            const [approvedResult, historyResult] = await Promise.all([
                supabase
                    .from('edit_requests')
                    .select('id')
                    .eq('registro_id', registro_id)
                    .eq('usuario_id', user.id)
                    .eq('status', 'aprobado')
                    .maybeSingle(),
                supabase
                    .from('history_edits')
                    .select('id', { count: 'exact', head: true })
                    .eq('registro_id', registro_id)
                    .eq('role', 'trabajador')
            ]);

            if (approvedResult.data) {
                approvedRequestId = approvedResult.data.id;
            } else if (historyResult.count !== null && historyResult.count > 0) {
                return NextResponse.json({ error: 'Ya realizaste una edición previa en este registro.' }, { status: 403 });
            }
        }

        // Validate Max Photos
        const currentPhotosCount = registro.fotos ? registro.fotos.length : 0;
        const deletingCount = photosToDelete.length;
        const newPhotosCount = photos.length;
        const finalPhotosCount = currentPhotosCount - deletingCount + newPhotosCount;

        if (finalPhotosCount > 2) {
            return NextResponse.json(
                { error: `Límite de fotos excedido. Resultado final sería ${finalPhotosCount} fotos. Máximo total: 2.` },
                { status: 400 }
            );
        }

        // === Track field changes (old vs new) ===
        const fieldChanges: Record<string, { old: any; new: any }> = {};
        const updateFields: Record<string, any> = {};

        if (lote_interno !== undefined && lote_interno !== registro.lote_interno) {
            fieldChanges['lote_interno'] = { old: registro.lote_interno, new: lote_interno };
            updateFields['lote_interno'] = lote_interno;
        }
        if (lote_producto !== undefined && lote_producto !== registro.lote_producto) {
            fieldChanges['lote_producto'] = { old: registro.lote_producto || '', new: lote_producto };
            updateFields['lote_producto'] = lote_producto;
        }
        if (guia !== undefined && guia !== registro.guia) {
            fieldChanges['guia'] = { old: registro.guia || '', new: guia };
            updateFields['guia'] = guia;
        }
        if (marca !== undefined && marca !== registro.marca) {
            fieldChanges['marca'] = { old: registro.marca || '', new: marca };
            updateFields['marca'] = marca;
        }
        if (cantidad !== undefined && parseInt(cantidad) !== registro.cantidad) {
            fieldChanges['cantidad'] = { old: registro.cantidad, new: parseInt(cantidad) };
            updateFields['cantidad'] = parseInt(cantidad);
        }

        // === Perform Save — run independent operations in parallel ===

        let deletedPhotosData: any[] = [];
        if (photosToDelete.length > 0) {
            const { data: fetchDelPhot } = await supabase
                .from('fotos')
                .select('id, datos_base64')
                .in('id', photosToDelete)
                .eq('registro_id', registro_id);

            if (fetchDelPhot) {
                // Keep the base64 structure so the frontend can render it
                deletedPhotosData = fetchDelPhot.map(p => ({
                    id: p.id,
                    data: p.datos_base64
                }));
            }
        }

        // Build all parallel operations
        const parallelOps: PromiseLike<any>[] = [];

        // 1. Update registro fields if changed
        if (Object.keys(updateFields).length > 0) {
            parallelOps.push(
                supabase.from('registros').update(updateFields).eq('id', registro_id).then()
            );
        }

        // 2. Delete Photos marked for deletion
        if (photosToDelete.length > 0) {
            parallelOps.push(
                supabase.from('fotos').delete().in('id', photosToDelete).eq('registro_id', registro_id).then()
            );
        }

        // 3. Log History
        const actionParts: string[] = [];
        if (photos.length > 0) actionParts.push(`add_photo:${photos.length}`);
        if (photosToDelete.length > 0) actionParts.push(`delete_photo:${photosToDelete.length}`);
        if (Object.keys(fieldChanges).length > 0) actionParts.push(`field_edit:${Object.keys(fieldChanges).length}`);

        parallelOps.push(
            supabase.from('history_edits').insert({
                registro_id,
                edited_by: user.id,
                role: user.roles,
                action: actionParts.join(',') || 'edit',
                photos_added: photos.length > 0 ? photos : null,
                photos_deleted: deletedPhotosData.length > 0 ? deletedPhotosData : (photosToDelete.length > 0 ? photosToDelete : null),
                field_changes: Object.keys(fieldChanges).length > 0 ? fieldChanges : null
            }).then()
        );

        // 4. Insert New Photos (batch insert instead of one-by-one)
        if (photos.length > 0) {
            const photoRecords = photos.map((photo: any) => ({
                registro_id,
                datos_base64: photo.data,
                descripcion: photo.description || 'Foto agregada en edición'
            }));
            parallelOps.push(
                supabase.from('fotos').insert(photoRecords).then()
            );
        }

        // 5. Clear Lock
        parallelOps.push(
            supabase.from('registros').update({
                edit_started_at: null,
                edit_expires_at: null,
                edit_started_by: null
            }).eq('id', registro_id).then()
        );

        // 6. Mark approved request as used
        if (approvedRequestId) {
            parallelOps.push(
                supabase.from('edit_requests').update({
                    status: 'usado',
                    resolved_at: new Date().toISOString()
                }).eq('id', approvedRequestId).then()
            );
        }

        // Execute all operations in parallel
        await Promise.all(parallelOps);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Edit save error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
