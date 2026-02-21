'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Navbar';
import { getAllOfflineRecords, getPendingRecords, markRecordSynced, deleteOfflineRecord } from '@/lib/temporal-db';
import type { OfflineRecord } from '@/lib/temporal-db';

function getCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
}

export default function TemporalClient() {
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [records, setRecords] = useState<OfflineRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [syncAllLoading, setSyncAllLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showSynced, setShowSynced] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        const uname = getCookie('user_name');
        const urole = getCookie('user_role');
        if (uname) setUserName(uname);
        if (urole === 'administrador' || urole === 'trabajador') setUserRole(urole);
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            const data = showSynced ? await getAllOfflineRecords() : await getPendingRecords();
            data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setRecords(data);
        } catch (err) {
            setError('Error al cargar registros offline');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [showSynced]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const syncRecord = async (record: OfflineRecord) => {
        if (!record.id) return;
        setSyncing(record.id);
        setError('');

        try {
            const selectedProduct = record.productoNombre;
            const syncPayload = {
                records: [{
                    localId: record.id,
                    trabajador_nombre: record.verificadoPor,
                    tipo_registro: 'control_calidad',
                    fecha_registro_local: record.timestamp,
                    datos: {
                        lote_interno: record.formData.loteInterno,
                        lote_producto: record.formData.loteProducto,
                        guia: record.formData.guia,
                        marca: record.formData.marca,
                        cantidad: parseInt(record.formData.cantidad),
                        producto_id: parseInt(record.formData.productoId),
                        producto_nombre: selectedProduct,
                        observaciones_generales: record.formData.observacionesGenerales,
                        verificado_por: record.verificadoPor,
                        controles: record.controles,
                    },
                }],
            };

            const res = await fetch('/api/temporal/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncPayload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al sincronizar');
            }

            try {
                const regRes = await fetch('/api/registros', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lote_interno: record.formData.loteInterno,
                        lote_producto: record.formData.loteProducto,
                        guia: record.formData.guia,
                        marca: record.formData.marca,
                        cantidad: parseInt(record.formData.cantidad),
                        producto_id: parseInt(record.formData.productoId),
                        producto_nombre: selectedProduct,
                        observaciones_generales: record.formData.observacionesGenerales,
                        verificado_por: record.verificadoPor,
                        controles: record.controles,
                        es_offline: true,
                        fecha_registro: record.timestamp,
                    }),
                });

                if (regRes.ok && record.fotos.length > 0) {
                    const { registro_id } = await regRes.json();
                    for (let i = 0; i < record.fotos.length; i++) {
                        if (record.fotos[i]) {
                            try {
                                await fetch('/api/fotos', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        registro_id,
                                        datos_base64: record.fotos[i],
                                        descripcion: `Foto ${i + 1} (offline)`,
                                    }),
                                });
                            } catch (e) { console.error(`Error uploading offline photo ${i + 1}:`, e); }
                        }
                    }
                }
            } catch (regErr) { console.error('Error saving to registros:', regErr); }

            await markRecordSynced(record.id);
            setSuccessMsg('Registro sincronizado correctamente');
            await loadRecords();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al sincronizar');
        } finally {
            setSyncing(null);
        }
    };

    const syncAll = async () => {
        setSyncAllLoading(true);
        setError('');
        const pending = records.filter(r => !r.synced);
        let syncedCount = 0;
        let errorCount = 0;

        for (const record of pending) {
            try {
                await syncRecord(record);
                syncedCount++;
            } catch { errorCount++; }
        }

        setSyncAllLoading(false);
        if (errorCount > 0) {
            setError(`${syncedCount} sincronizados, ${errorCount} con error`);
        } else {
            setSuccessMsg(`${syncedCount} registro(s) sincronizado(s) correctamente`);
            setTimeout(() => setSuccessMsg(''), 4000);
        }
        await loadRecords();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este registro offline? Esta acción no se puede deshacer.')) return;
        try {
            await deleteOfflineRecord(id);
            await loadRecords();
            setSuccessMsg('Registro eliminado');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch { setError('Error al eliminar registro'); }
    };

    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return isoString; }
    };

    const pendingCount = records.filter(r => !r.synced).length;

    return (
        <div className="page-wrapper">
            <Sidebar userName={userName} userRole={userRole} />
            <main className="main-content">

                {/* Offline Banner */}
                {!isOnline && (
                    <div className="offline-banner">
                        <span className="offline-icon">📡</span>
                        <div>
                            <div className="offline-title">SIN CONEXIÓN A INTERNET</div>
                            <div className="offline-sub">Los registros del módulo Registro se almacenan aquí automáticamente</div>
                        </div>
                    </div>
                )}

                {/* Premium Header */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system">
                            <span className="dot-pulse" style={!isOnline ? { background: '#ef4444' } : {}}></span>
                            TEMPORAL
                        </div>
                        <h1 className="title">Registros Temporales</h1>
                        <p className="subtitle">
                            Registros guardados offline desde el módulo de Registro.
                            {pendingCount > 0 && (
                                <span className="pending-badge">{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
                            )}
                        </p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-card">
                            <span className="stat-number">{records.length}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-card stat-pending">
                            <span className="stat-number">{pendingCount}</span>
                            <span className="stat-label">Pendientes</span>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="action-bar">
                    <div className="action-left">
                        <button onClick={loadRecords} disabled={loading} className="btn-refresh">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" /></svg>
                            Actualizar
                        </button>
                        <label className="toggle-label">
                            <input type="checkbox" checked={showSynced} onChange={(e) => setShowSynced(e.target.checked)} />
                            <span className="toggle-text">Mostrar sincronizados</span>
                        </label>
                    </div>
                    {pendingCount > 0 && isOnline && (
                        <button onClick={syncAll} disabled={syncAllLoading} className="btn-sync-all">
                            {syncAllLoading ? (
                                <><span className="spinner-sm"></span> Sincronizando...</>
                            ) : (
                                <>🔄 Sincronizar Todo ({pendingCount})</>
                            )}
                        </button>
                    )}
                </div>

                {/* Messages */}
                {successMsg && <div className="alert-success-custom">✅ {successMsg}</div>}
                {error && <div className="alert-error-custom">❌ {error}</div>}

                {/* Records List */}
                <div className="records-container">
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner-lg"></div>
                            <p>Cargando registros...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <h3 className="empty-title">
                                {showSynced ? 'No hay registros temporales' : 'Sin registros pendientes'}
                            </h3>
                            <p className="empty-text">
                                Los registros aparecen aquí cuando se guardan desde el módulo de Registro sin conexión a internet.
                            </p>
                        </div>
                    ) : (
                        <div className="records-list">
                            {records.map((rec, idx) => (
                                <div key={rec.id || idx} className={`record-card ${rec.synced ? 'synced' : 'pending'}`}>
                                    <div className="record-header" onClick={() => setExpandedId(expandedId === rec.id ? null : (rec.id ?? null))}>
                                        <div className="record-main-info">
                                            <div className="record-product">{rec.productoNombre}</div>
                                            <div className="record-meta">
                                                <span className="meta-item">📦 Lote: {rec.formData.loteInterno}</span>
                                                <span className="meta-item">🏷️ {rec.formData.marca}</span>
                                                <span className="meta-item">📅 {formatDate(rec.timestamp)}</span>
                                            </div>
                                        </div>
                                        <div className="record-actions-area">
                                            <span className={`status-badge ${rec.synced ? 'badge-synced' : 'badge-pending'}`}>
                                                {rec.synced ? '✓ Sincronizado' : '⏳ Pendiente'}
                                            </span>
                                            <svg
                                                className={`chevron ${expandedId === rec.id ? 'open' : ''}`}
                                                width="20" height="20" viewBox="0 0 24 24"
                                                fill="none" stroke="currentColor" strokeWidth="2"
                                            >
                                                <polyline points="6 9 12 15 18 9"></polyline>
                                            </svg>
                                        </div>
                                    </div>

                                    {expandedId === rec.id && (
                                        <div className="record-details">
                                            <div className="details-grid">
                                                <div className="detail-item">
                                                    <span className="detail-label">Lote Producto</span>
                                                    <span className="detail-value">{rec.formData.loteProducto}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Guía</span>
                                                    <span className="detail-value">{rec.formData.guia}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Cantidad</span>
                                                    <span className="detail-value">{rec.formData.cantidad}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-label">Verificado por</span>
                                                    <span className="detail-value">{rec.verificadoPor}</span>
                                                </div>
                                            </div>

                                            {rec.formData.observacionesGenerales && (
                                                <div className="detail-obs">
                                                    <span className="detail-label">Observaciones</span>
                                                    <p className="detail-value">{rec.formData.observacionesGenerales}</p>
                                                </div>
                                            )}

                                            {rec.controles.length > 0 && (
                                                <div className="controls-section">
                                                    <span className="detail-label">Controles de Calidad ({rec.controles.length})</span>
                                                    <div className="controls-list">
                                                        {rec.controles.map((ctrl, ci) => (
                                                            <div key={ci} className={`control-item ${ctrl.fueraDeRango ? 'out-of-range' : ''}`}>
                                                                <span className="control-name">{ctrl.parametroNombre}</span>
                                                                <span className="control-expected">{ctrl.rangoCompleto}</span>
                                                                <span className="control-result">
                                                                    {ctrl.valorControl !== null ? ctrl.valorControl : ctrl.textoControl || '-'}
                                                                </span>
                                                                {ctrl.fueraDeRango && <span className="control-alert">⚠️</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {rec.fotos.length > 0 && (
                                                <div className="photos-section">
                                                    <span className="detail-label">Fotos ({rec.fotos.length})</span>
                                                    <div className="photos-grid">
                                                        {rec.fotos.map((foto, fi) => (
                                                            <img key={fi} src={foto} alt={`Foto ${fi + 1}`} className="photo-thumb" />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="record-buttons">
                                                {!rec.synced && isOnline && (
                                                    <button onClick={() => syncRecord(rec)} disabled={syncing === rec.id} className="btn-sync">
                                                        {syncing === rec.id ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
                                                    </button>
                                                )}
                                                <button onClick={() => rec.id && handleDelete(rec.id)} className="btn-delete">
                                                    🗑️ Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Panel */}
                <div className="info-panel">
                    <strong>ℹ️ ¿Cómo funciona?</strong> Cuando se pierde la conexión a internet, el módulo de Registro
                    guarda automáticamente los datos aquí. Al recuperar la conexión, sincronice los registros desde esta página.
                </div>
            </main>

            <style jsx>{`
                .page-wrapper {
                    min-height: 100vh;
                    background: #f8fafc;
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .main-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 32px;
                }

                /* Offline Banner */
                .offline-banner {
                    background: linear-gradient(135deg, #dc2626, #b91c1c);
                    color: white;
                    padding: 0.85rem 1.25rem;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    animation: pulse-glow 2s infinite;
                    box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
                }
                .offline-icon { font-size: 1.5rem; }
                .offline-title { font-weight: 700; font-size: 0.95rem; }
                .offline-sub { font-size: 0.8rem; opacity: 0.9; margin-top: 2px; }

                /* Premium Header */
                .header-container {
                    background: white;
                    border-radius: 16px;
                    padding: 1.5rem 2rem;
                    margin-bottom: 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    border: 1px solid #e2e8f0;
                }
                .badge-system {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: #6366f1;
                    text-transform: uppercase;
                    margin-bottom: 0.25rem;
                }
                .dot-pulse {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #22c55e;
                    animation: pulse-dot 2s infinite;
                }
                .title {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #1a1a2e;
                    margin: 0.15rem 0 0.25rem;
                    letter-spacing: -0.5px;
                }
                .subtitle {
                    color: #64748b;
                    font-size: 0.9rem;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .pending-badge {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.15rem 0.6rem;
                    border-radius: 20px;
                }
                .header-stats {
                    display: flex;
                    gap: 0.75rem;
                }
                .stat-card {
                    text-align: center;
                    padding: 0.75rem 1.25rem;
                    border-radius: 12px;
                    background: #f1f5f9;
                    min-width: 90px;
                }
                .stat-pending {
                    background: #fffbeb;
                    color: #d97706;
                }
                .stat-number {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1;
                }
                .stat-pending .stat-number { color: #d97706; }

                .stat-label {
                    font-size: 0.7rem;
                    color: #64748b;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .stat-pending .stat-label { color: #b45309; }

                /* Action Bar */
                .action-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .action-left {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }
                .btn-refresh {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: white;
                    border: 1px solid #e2e8f0;
                    padding: 0.6rem 1rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #475569;
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .btn-refresh:hover { background: #f8fafc; border-color: #cbd5e1; color: #1e293b; transform: translateY(-1px); }
                .toggle-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: #64748b;
                    user-select: none;
                }
                .toggle-label input { width: 16px; height: 16px; accent-color: #6366f1; }

                .btn-sync-all {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    border: none;
                    padding: 0.7rem 1.5rem;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .btn-sync-all:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4); }
                .btn-sync-all:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }

                /* Alerts */
                .alert-success-custom {
                    background: #dcfce7;
                    border: 1px solid #86efac;
                    color: #166534;
                    padding: 1rem;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    font-weight: 600;
                    font-size: 0.95rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .alert-error-custom {
                    background: #fef2f2;
                    border: 1px solid #fca5a5;
                    color: #991b1b;
                    padding: 1rem;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    font-weight: 600;
                    font-size: 0.95rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                /* Records Container */
                .records-container {
                    background: white;
                    border-radius: 20px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
                    border: 1px solid #e2e8f0;
                    min-height: 400px;
                }

                /* Empty State */
                .empty-state {
                    text-align: center;
                    padding: 4rem 1rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                }
                .empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.8; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); }
                .empty-title { font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0; }
                .empty-text { font-size: 0.95rem; color: #64748b; margin: 0.5rem 0 0; max-width: 450px; line-height: 1.5; }

                /* Record Cards */
                .records-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .record-card {
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    background: white;
                }
                .record-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transform: translateY(-1px); }
                .record-card.synced { border-left: 5px solid #22c55e; background: #fbfdfc; }
                .record-card.pending { border-left: 5px solid #f59e0b; }

                .record-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    cursor: pointer;
                    gap: 1.5rem;
                }
                .record-header:hover { background: #f8fafc; }

                .record-main-info { flex: 1; min-width: 0; }
                .record-product {
                    font-weight: 800;
                    font-size: 1.1rem;
                    color: #0f172a;
                    margin-bottom: 0.4rem;
                }
                .record-meta {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                    align-items: center;
                }
                .meta-item {
                    font-size: 0.85rem;
                    color: #64748b;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    background: #f1f5f9;
                    padding: 0.2rem 0.6rem;
                    border-radius: 6px;
                    font-weight: 500;
                }

                .record-actions-area {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-shrink: 0;
                }

                .status-badge {
                    font-size: 0.75rem;
                    font-weight: 800;
                    padding: 0.35rem 0.75rem;
                    border-radius: 50px;
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .badge-synced { background: #dcfce7; color: #15803d; }
                .badge-pending { background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; }

                .chevron {
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    color: #94a3b8;
                }
                .chevron.open { transform: rotate(180deg); color: #6366f1; }

                /* Expanded Details */
                .record-details {
                    padding: 0 1.5rem 1.5rem;
                    border-top: 1px solid #f1f5f9;
                    animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    background: #fcfcfd;
                }
                .details-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-top: 1.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                }
                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }
                .detail-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #94a3b8;
                }
                .detail-value {
                    font-size: 1rem;
                    color: #1e293b;
                    font-weight: 600;
                }
                .detail-obs { margin-top: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
                .detail-obs p { margin: 0.5rem 0 0; color: #334155; line-height: 1.6; }

                /* Controls Section */
                .controls-section { margin-top: 1.5rem; }
                .controls-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                }
                .control-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.75rem 1rem;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .control-item:hover { border-color: #cbd5e1; }
                .control-item.out-of-range { background: #fef2f2; border-color: #fca5a5; }
                .control-name { font-weight: 600; color: #334155; flex: 1; }
                .control-expected { color: #6366f1; font-weight: 500; font-size: 0.85rem; background: #eef2ff; padding: 0.2rem 0.5rem; border-radius: 4px; }
                .control-result { font-weight: 700; color: #0f172a; min-width: 60px; text-align: right; }
                .control-alert { font-size: 1.1rem; }

                /* Photos */
                .photos-section { margin-top: 1.5rem; }
                .photos-grid {
                    display: flex;
                    gap: 1rem;
                    margin-top: 0.75rem;
                    flex-wrap: wrap;
                }
                .photo-thumb {
                    width: 100px;
                    height: 100px;
                    border-radius: 12px;
                    object-fit: cover;
                    border: 2px solid #e2e8f0;
                    transition: transform 0.2s;
                    cursor: zoom-in;
                }
                .photo-thumb:hover { transform: scale(1.05); border-color: #6366f1; }

                /* Buttons */
                .record-buttons {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    justify-content: flex-end;
                }
                .btn-sync {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    border: none;
                    padding: 0.6rem 1.25rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
                }
                .btn-sync:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3); }
                .btn-sync:disabled { opacity: 0.7; cursor: not-allowed; }

                .btn-delete {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: white;
                    border: 1px solid #fca5a5;
                    color: #dc2626;
                    padding: 0.6rem 1.25rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .btn-delete:hover { background: #fef2f2; border-color: #ef4444; }

                /* Info Panel */
                .info-panel {
                    margin-top: 2rem;
                    background: linear-gradient(135deg, #eff6ff, #eef2ff);
                    border: 1px solid #bfdbfe;
                    border-radius: 16px;
                    padding: 1.25rem 1.5rem;
                    font-size: 0.9rem;
                    color: #1e40af;
                    line-height: 1.6;
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }
                .info-panel strong { color: #1e3a8a; }

                /* Animations */
                @keyframes pulse-glow {
                    0%, 100% { opacity: 1; box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3); }
                    50% { opacity: 0.92; box-shadow: 0 4px 25px rgba(220, 38, 38, 0.5); }
                }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.7; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .main-content { padding: 24px 16px; }
                    .header-container { flex-direction: column; align-items: flex-start; gap: 1rem; padding: 1.25rem; }
                    .header-stats { width: 100%; margin-top: 0.5rem; }
                    .stat-card { flex: 1; }
                    .record-header { flex-direction: column; align-items: flex-start; gap: 1rem; padding: 1rem; }
                    .record-actions-area { width: 100%; justify-content: space-between; }
                    .details-grid { grid-template-columns: 1fr; gap: 1rem; }
                    .action-bar { flex-direction: column; align-items: stretch; gap: 1rem; }
                    .action-left { justify-content: space-between; }
                    .btn-sync-all { text-align: center; justify-content: center; }
                    .record-buttons { flex-direction: column-reverse; }
                    .btn-sync, .btn-delete { width: 100%; justify-content: center; }
                }
            `}</style>
        </div>
    );
}
