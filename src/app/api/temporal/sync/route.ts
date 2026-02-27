import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
const createAdminClient = () => createServiceClient();

interface OfflineRecordPayload {
    localUuid: string;
    trabajadorId: number;
    trabajadorNombre: string;
    registradoPorId: number;
    registradoPorNombre: string;
    fechaRegistroLocal: string;
    tipoRegistro: string;
    observaciones?: string;
    datos?: Record<string, unknown>;
}

// POST - Sync offline records to the central database
export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado. Debe iniciar sesión para sincronizar.' }, { status: 401 });
        }

        // Fetch user name for audit logging
        const adminClient = createServiceClient();
        const { data: currentUser } = await adminClient
            .from('usuarios')
            .select('nombre_completo')
            .eq('id', parseInt(userId))
            .single();
        const userName = currentUser?.nombre_completo || 'Desconocido';

        const currentUserId = parseInt(userId);
        const { records } = await request.json() as { records: OfflineRecordPayload[] };

        if (!records || !Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ error: 'No hay registros para sincronizar' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const results: { uuid: string; status: string; alert?: string }[] = [];
        const alerts: string[] = [];

        for (const record of records) {
            // Check for duplicates
            const { data: existing } = await supabase
                .from('registros_temporales')
                .select('id')
                .eq('local_uuid', record.localUuid)
                .single();

            if (existing) {
                results.push({ uuid: record.localUuid, status: 'duplicado' });
                continue;
            }

            // Validate user match - the person syncing must be the same who registered
            const userMatches = record.registradoPorId === currentUserId;

            const estado = userMatches ? 'sincronizado' : 'pendiente_validacion';

            // Insert the temporal record
            const { data: inserted, error: insertError } = await supabase
                .from('registros_temporales')
                .insert({
                    trabajador_id: record.trabajadorId,
                    trabajador_nombre: record.trabajadorNombre,
                    registrado_por_id: record.registradoPorId,
                    registrado_por_nombre: record.registradoPorNombre,
                    fecha_registro_local: record.fechaRegistroLocal,
                    tipo_registro: record.tipoRegistro,
                    datos: {
                        observaciones: record.observaciones || '',
                        ...(record.datos || {}),
                    },
                    es_temporal: true,
                    estado,
                    local_uuid: record.localUuid,
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('Error inserting temporal record:', insertError);
                results.push({ uuid: record.localUuid, status: 'error' });
                continue;
            }

            if (!userMatches) {
                // FRAUD ALERT - Create audit log entry
                const alertMsg = `⚠️ Posible irregularidad detectada – El usuario "${userName}" (ID: ${currentUserId}) intentó sincronizar un registro creado offline por "${record.registradoPorNombre}" (ID: ${record.registradoPorId}). Registro pendiente de validación.`;

                await supabase
                    .from('auditoria_temporal')
                    .insert({
                        registro_temporal_id: inserted.id,
                        tipo_evento: 'fraude_detectado',
                        usuario_offline_id: record.registradoPorId,
                        usuario_sync_id: currentUserId,
                        mensaje: alertMsg,
                        datos_extra: {
                            trabajador_id: record.trabajadorId,
                            trabajador_nombre: record.trabajadorNombre,
                            fecha_registro: record.fechaRegistroLocal,
                            tipo_registro: record.tipoRegistro,
                        },
                    });

                alerts.push(alertMsg);
                results.push({
                    uuid: record.localUuid,
                    status: 'pendiente_validacion',
                    alert: alertMsg,
                });
            } else {
                // Normal sync - also log it
                await supabase
                    .from('auditoria_temporal')
                    .insert({
                        registro_temporal_id: inserted.id,
                        tipo_evento: 'sincronizacion',
                        usuario_offline_id: record.registradoPorId,
                        usuario_sync_id: currentUserId,
                        mensaje: `Registro temporal sincronizado correctamente por "${userName}".`,
                        datos_extra: {
                            trabajador_id: record.trabajadorId,
                            trabajador_nombre: record.trabajadorNombre,
                            fecha_registro: record.fechaRegistroLocal,
                        },
                    });

                results.push({ uuid: record.localUuid, status: 'sincronizado' });
            }
        }

        return NextResponse.json({
            success: true,
            results,
            alerts,
            totalSynced: results.filter(r => r.status === 'sincronizado').length,
            totalPending: results.filter(r => r.status === 'pendiente_validacion').length,
            totalDuplicated: results.filter(r => r.status === 'duplicado').length,
            totalErrors: results.filter(r => r.status === 'error').length,
        });
    } catch (error) {
        console.error('Sync API error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
