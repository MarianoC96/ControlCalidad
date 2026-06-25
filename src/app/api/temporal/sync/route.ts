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

        // 1) Validar trabajadores referenciados: deben existir y no estar borrados.
        const trabajadorIds = [...new Set(
            records
                .map((r) => r.trabajadorId)
                .filter((id): id is number => Number.isInteger(id))
        )];

        const trabajadoresValidos = new Set<number>();
        if (trabajadorIds.length > 0) {
            const { data: trabajadores, error: trabError } = await supabase
                .from('usuarios')
                .select('id')
                .in('id', trabajadorIds)
                .eq('is_deleted', false);
            if (trabError) throw trabError;
            for (const t of trabajadores || []) trabajadoresValidos.add(t.id);
        }

        // 2) Preparar filas. SEGURIDAD: registrado_por_id/nombre se DERIVAN del
        //    usuario autenticado en el servidor (se ignora lo que venga en el
        //    payload) → la atribución almacenada no se puede falsear ni apuntar a
        //    un trabajador arbitrario. La comparación con el registrador que el
        //    dispositivo "reclama" queda como heurística antifraude suave.
        interface PreparedRow {
            record: OfflineRecordPayload;
            esLegitimo: boolean;
            row: Record<string, unknown>;
        }
        const prepared: PreparedRow[] = [];

        for (const record of records) {
            if (!record?.localUuid) {
                results.push({ uuid: record?.localUuid || 'desconocido', status: 'error' });
                continue;
            }
            if (!trabajadoresValidos.has(record.trabajadorId)) {
                // Trabajador inexistente/borrado → no se inserta.
                results.push({ uuid: record.localUuid, status: 'error' });
                continue;
            }

            const esLegitimo = record.registradoPorId === currentUserId;
            const estado = esLegitimo ? 'sincronizado' : 'pendiente_validacion';

            prepared.push({
                record,
                esLegitimo,
                row: {
                    trabajador_id: record.trabajadorId,
                    trabajador_nombre: record.trabajadorNombre,
                    registrado_por_id: currentUserId,   // SERVER-DERIVED
                    registrado_por_nombre: userName,    // SERVER-DERIVED
                    fecha_registro_local: record.fechaRegistroLocal,
                    tipo_registro: record.tipoRegistro,
                    datos: {
                        observaciones: record.observaciones || '',
                        ...(record.datos || {}),
                    },
                    es_temporal: true,
                    estado,
                    local_uuid: record.localUuid,
                },
            });
        }

        // 3) Upsert en BATCH con dedupe garantizado por UNIQUE(local_uuid):
        //    ON CONFLICT DO NOTHING. Lo devuelto = filas realmente insertadas;
        //    las que no vuelven es porque ya existían (duplicados).
        //    ⚠️ REQUIERE migración 20260624000001_unique_local_uuid_temporales.sql
        //       aplicada; sin el índice único, el dedupe no está garantizado.
        const insertedByUuid = new Map<string, number>();
        if (prepared.length > 0) {
            const { data: insertedRows, error: upsertError } = await supabase
                .from('registros_temporales')
                .upsert(prepared.map((p) => p.row), {
                    onConflict: 'local_uuid',
                    ignoreDuplicates: true,
                })
                .select('id, local_uuid');
            if (upsertError) throw upsertError;
            for (const r of insertedRows || []) insertedByUuid.set(r.local_uuid, r.id);
        }

        // 4) Auditoría en BATCH solo para las filas realmente insertadas.
        const auditRows: Record<string, unknown>[] = [];
        for (const p of prepared) {
            const insertedId = insertedByUuid.get(p.record.localUuid);
            if (insertedId === undefined) {
                // No insertada → ya existía (ON CONFLICT DO NOTHING) → duplicado.
                results.push({ uuid: p.record.localUuid, status: 'duplicado' });
                continue;
            }

            if (p.esLegitimo) {
                auditRows.push({
                    registro_temporal_id: insertedId,
                    tipo_evento: 'sincronizacion',
                    usuario_offline_id: currentUserId,
                    usuario_sync_id: currentUserId,
                    mensaje: `Registro temporal sincronizado correctamente por "${userName}".`,
                    datos_extra: {
                        trabajador_id: p.record.trabajadorId,
                        trabajador_nombre: p.record.trabajadorNombre,
                        fecha_registro: p.record.fechaRegistroLocal,
                    },
                });
                results.push({ uuid: p.record.localUuid, status: 'sincronizado' });
            } else {
                const alertMsg = `⚠️ Posible irregularidad detectada – El usuario "${userName}" (ID: ${currentUserId}) sincronizó un registro que el dispositivo atribuía a "${p.record.registradoPorNombre}" (ID: ${p.record.registradoPorId}). Registro pendiente de validación.`;
                auditRows.push({
                    registro_temporal_id: insertedId,
                    tipo_evento: 'fraude_detectado',
                    usuario_offline_id: p.record.registradoPorId,
                    usuario_sync_id: currentUserId,
                    mensaje: alertMsg,
                    datos_extra: {
                        trabajador_id: p.record.trabajadorId,
                        trabajador_nombre: p.record.trabajadorNombre,
                        fecha_registro: p.record.fechaRegistroLocal,
                        tipo_registro: p.record.tipoRegistro,
                    },
                });
                alerts.push(alertMsg);
                results.push({ uuid: p.record.localUuid, status: 'pendiente_validacion', alert: alertMsg });
            }
        }

        if (auditRows.length > 0) {
            // La auditoría es secundaria: si falla, se registra pero NO se aborta
            // la sincronización (los registros ya están persistidos).
            const { error: auditError } = await supabase
                .from('auditoria_temporal')
                .insert(auditRows);
            if (auditError) {
                console.error('Error inserting audit batch:', auditError);
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
