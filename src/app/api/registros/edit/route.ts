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

        // Fetch User and Registro in PARALLEL
        const [userResult, regResult] = await Promise.all([
            supabase
                .from('usuarios')
                .select('id, usuario, roles, role_id')
                .eq('id', parseInt(userId))
                .single(),
            supabase
                .from('registros')
                .select('id, lote_interno, lote_producto, guia, marca, cantidad, edit_started_by, edit_expires_at, fotos(id)')
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

        // 1. Determine if user has direct edit permission (Only sadmin, admins and those with 'solicitudes' module)
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



        // 2. Validate Password for anyone with direct edit permission
        if (hasDirectEditPermission) {
            if (!password) {
                return NextResponse.json({ error: 'Contraseña requerida', requirePassword: true }, { status: 401 });
            }
            const match = await verifyUserPassword(user.usuario, password);
            if (!match) {
                return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
            }
        }

        // 3. Validate Lock Ownership and Expiry
        if (registro.edit_started_by !== user.id) {
            return NextResponse.json({ error: 'No tienes el bloqueo de edición de este registro.' }, { status: 403 });
        }

        const now = new Date();
        const expiresAt = registro.edit_expires_at ? new Date(registro.edit_expires_at) : null;
        if (expiresAt && expiresAt < now) {
            return NextResponse.json({ error: 'El tiempo de edición ha expirado.' }, { status: 403 });
        }

        // 4. Validate Request for those WITHOUT direct permission
        let approvedRequestId = null;
        if (!hasDirectEditPermission) {
            const { data: approvedRequest } = await supabase
                .from('edit_requests')
                .select('id')
                .eq('registro_id', registro_id)
                .eq('usuario_id', user.id)
                .eq('status', 'aprobado')
                .maybeSingle();

            if (!approvedRequest) {
                return NextResponse.json(
                    { error: 'No tienes una solicitud de edición aprobada para guardar estos cambios.' },
                    { status: 403 }
                );
            }
            approvedRequestId = approvedRequest.id;
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

        // Acción para el log de historial.
        const actionParts: string[] = [];
        if (photos.length > 0) actionParts.push(`add_photo:${photos.length}`);
        if (photosToDelete.length > 0) actionParts.push(`delete_photo:${photosToDelete.length}`);
        if (Object.keys(fieldChanges).length > 0) actionParts.push(`field_edit:${Object.keys(fieldChanges).length}`);

        // Guardado ATÓMICO de toda la edición vía RPC transaccional: aplica
        // cambios de campos, borra/inserta fotos, registra historial, libera el
        // lock y marca la solicitud "usado" — todo o nada. La RPC revalida
        // además el lock dentro de la transacción (cierra la carrera).
        // ⚠️ REQUIERE migración 20260624000004_rpc_guardar_edicion_registro.sql
        //    aplicada en la BD; sin ella, esta ruta responderá error.
        const { error: rpcError } = await supabase.rpc('guardar_edicion_registro', {
            p_registro_id: registro_id,
            p_user_id: user.id,
            p_role: user.roles,
            p_update_fields: updateFields,
            p_photos_to_delete: photosToDelete,
            p_new_photos: photos,
            p_action: actionParts.join(',') || 'edit',
            p_photos_added: photos.length > 0 ? photos : null,
            p_photos_deleted:
                deletedPhotosData.length > 0
                    ? deletedPhotosData
                    : photosToDelete.length > 0
                        ? photosToDelete
                        : null,
            p_field_changes: Object.keys(fieldChanges).length > 0 ? fieldChanges : null,
            p_approved_request_id: approvedRequestId,
        });

        if (rpcError) {
            // La RPC lanza P0001 si el lock ya no es válido/expiró (carrera).
            const isLockError = (rpcError as any).message?.includes('bloqueo de edición');
            return NextResponse.json(
                { error: isLockError ? 'El bloqueo de edición no es válido o ha expirado.' : 'Error al guardar la edición.' },
                { status: isLockError ? 409 : 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Edit save error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
