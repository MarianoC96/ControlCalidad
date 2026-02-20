'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Navbar';

interface AuditLog {
    id: number;
    registro_temporal_id: number;
    tipo_evento: string;
    usuario_offline_id: number;
    usuario_sync_id: number;
    mensaje: string;
    datos_extra: Record<string, unknown> | null;
    created_at: string;
    resuelto: boolean;
    resuelto_por: number | null;
    resuelto_at: string | null;
}

interface PendingRecord {
    id: number;
    trabajador_nombre: string;
    registrado_por_nombre: string;
    fecha_registro_local: string;
    tipo_registro: string;
    estado: string;
    datos: Record<string, unknown> | null;
}

function getCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
}

export default function AuditoriaClient() {
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('administrador');
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showResolved, setShowResolved] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [processing, setProcessing] = useState<number | null>(null);

    useEffect(() => {
        const uname = getCookie('user_name');
        const urole = getCookie('user_role');
        if (uname) setUserName(uname);
        if (urole === 'administrador' || urole === 'trabajador') setUserRole(urole);
    }, []);

    const fetchAuditData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/temporal/audit?resolved=${showResolved}`);
            if (res.status === 403) {
                setError('No tienes permisos para acceder a la auditoría');
                return;
            }
            if (!res.ok) throw new Error('Error al obtener datos');
            const data = await res.json();
            setAuditLogs(data.auditLogs || []);
            setPendingRecords(data.pendingRecords || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [showResolved]);

    useEffect(() => {
        fetchAuditData();
    }, [fetchAuditData]);

    const handleAction = async (registroId: number, auditId: number | null, action: 'validado' | 'rechazado') => {
        setProcessing(registroId);
        setError('');
        try {
            const res = await fetch('/api/temporal/audit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registroId, auditId, action }),
            });
            if (!res.ok) throw new Error('Error al procesar');
            setSuccessMsg(`Registro ${action === 'validado' ? 'validado' : 'rechazado'} correctamente`);
            await fetchAuditData();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setProcessing(null);
        }
    };

    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    };

    const fraudAlerts = auditLogs.filter(log => log.tipo_evento === 'fraude_detectado');

    return (
        <div className="page-wrapper">
            <Sidebar userName={userName} userRole={userRole} />
            <main className="main-content">

                {/* Premium Header */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system">
                            <span className="dot-pulse"></span>
                            AUDITORÍA
                        </div>
                        <h1 className="title">Auditoría Temporal</h1>
                        <p className="subtitle">
                            Panel de control para validar registros offline y revisar alertas de irregularidad.
                        </p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-card">
                            <span className="stat-number">{pendingRecords.length}</span>
                            <span className="stat-label">Pendientes</span>
                        </div>
                        {fraudAlerts.length > 0 && (
                            <div className="stat-card stat-alert">
                                <span className="stat-number">{fraudAlerts.length}</span>
                                <span className="stat-label">Alertas</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages */}
                {successMsg && (
                    <div className="alert-success-custom">
                        ✅ {successMsg}
                    </div>
                )}
                {error && (
                    <div className="alert-error-custom">
                        ❌ {error}
                    </div>
                )}

                {/* Fraud Alerts Section */}
                {fraudAlerts.length > 0 && (
                    <div className="fraud-section">
                        <h2 className="section-title alert-title">
                            🚨 Alertas de Irregularidad ({fraudAlerts.length})
                        </h2>
                        <div className="alerts-grid">
                            {fraudAlerts.map(alert => (
                                <div key={alert.id} className="alert-card">
                                    <div className="alert-header">
                                        <p className="alert-message">{alert.mensaje}</p>
                                        <span className="alert-time">{formatDate(alert.created_at)}</span>
                                    </div>
                                    <div className="alert-meta">
                                        {alert.datos_extra && (
                                            <span>Trabajador: <strong>{alert.datos_extra.trabajador_nombre as string}</strong></span>
                                        )}
                                    </div>
                                    {!alert.resuelto ? (
                                        <div className="alert-actions">
                                            <button
                                                className="btn-validate"
                                                onClick={() => handleAction(alert.registro_temporal_id, alert.id, 'validado')}
                                                disabled={processing === alert.registro_temporal_id}
                                            >
                                                ✅ Validar
                                            </button>
                                            <button
                                                className="btn-reject"
                                                onClick={() => handleAction(alert.registro_temporal_id, alert.id, 'rechazado')}
                                                disabled={processing === alert.registro_temporal_id}
                                            >
                                                ❌ Rechazar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="alert-resolved">
                                            ✓ Resuelto
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Records */}
                <div className="records-container">
                    <div className="section-header">
                        <h2 className="section-title">
                            📋 Registros Pendientes de Validación ({pendingRecords.length})
                        </h2>
                        <button onClick={fetchAuditData} disabled={loading} className="btn-refresh">
                            🔄 Actualizar
                        </button>
                    </div>

                    {loading ? (
                        <div className="empty-state">
                            <span className="spinner-lg"></span>
                            <p>Cargando registros...</p>
                        </div>
                    ) : pendingRecords.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">✓</div>
                            <h3>Todo al día</h3>
                            <p className="empty-text">
                                No hay registros pendientes de validación en este momento.
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Trabajador</th>
                                        <th>Tipo</th>
                                        <th>Fecha Registro</th>
                                        <th>Registrado por</th>
                                        <th>Observaciones</th>
                                        <th className="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingRecords.map(rec => (
                                        <tr key={rec.id}>
                                            <td className="text-gray">#{rec.id}</td>
                                            <td className="font-medium">{rec.trabajador_nombre}</td>
                                            <td className="capitalize">{rec.tipo_registro.replace('_', ' ')}</td>
                                            <td>{formatDate(rec.fecha_registro_local)}</td>
                                            <td>{rec.registrado_por_nombre}</td>
                                            <td className="truncate-cell">{rec.datos?.observaciones as string || '-'}</td>
                                            <td className="text-center">
                                                <div className="action-buttons">
                                                    <button
                                                        onClick={() => handleAction(rec.id, null, 'validado')}
                                                        disabled={processing === rec.id}
                                                        className="btn-icon btn-check"
                                                        title="Validar registro"
                                                    >
                                                        ✅
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(rec.id, null, 'rechazado')}
                                                        disabled={processing === rec.id}
                                                        className="btn-icon btn-cross"
                                                        title="Rechazar registro"
                                                    >
                                                        ❌
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Audit Log History */}
                <div className="history-container">
                    <div className="section-header">
                        <h2 className="section-title history-title">
                            📜 Historial de Auditoría
                        </h2>
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={showResolved}
                                onChange={(e) => setShowResolved(e.target.checked)}
                            />
                            Mostrar resueltos
                        </label>
                    </div>

                    {auditLogs.length === 0 ? (
                        <p className="empty-text-simple">No hay registros de auditoría</p>
                    ) : (
                        <div className="logs-list">
                            {auditLogs.map(log => (
                                <div key={log.id} className={`log-item ${log.tipo_evento}`}>
                                    <div className="log-content">
                                        <div className="log-main">
                                            <span className={`log-badge ${log.tipo_evento}`}>
                                                {log.tipo_evento === 'fraude_detectado' ? '🚨 FRAUDE' :
                                                    log.tipo_evento === 'validacion' ? '✓ VALIDACIÓN' : '🔄 SYNC'}
                                            </span>
                                            <span className="log-message">{log.mensaje}</span>
                                        </div>
                                        <span className="log-date">{formatDate(log.created_at)}</span>
                                    </div>
                                    {log.resuelto && (
                                        <div className="log-footer">
                                            Resuelto {log.resuelto_at ? formatDate(log.resuelto_at) : ''}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
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
                .stat-alert {
                    background: #fef2f2;
                    color: #b91c1c;
                }
                .stat-number {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1;
                }
                .stat-alert .stat-number { color: #b91c1c; }
                .stat-label {
                    font-size: 0.7rem;
                    color: #64748b;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .stat-alert .stat-label { color: #7f1d1d; }

                /* Fraud Section */
                .fraud-section {
                    background: #fff;
                    border: 1px solid #fee2e2;
                    border-left: 5px solid #ef4444;
                    border-radius: 16px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.05);
                }
                .alert-title { color: #991b1b; display: flex; align-items: center; gap: 0.5rem; }
                .alerts-grid { display: grid; gap: 1rem; margin-top: 1rem; }
                .alert-card {
                    background: #fef2f2;
                    border: 1px solid #fca5a5;
                    border-radius: 10px;
                    padding: 1rem;
                }
                .alert-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
                .alert-message { font-weight: 600; color: #991b1b; margin: 0; }
                .alert-time { font-size: 0.8rem; color: #7f1d1d; opacity: 0.8; }
                .alert-meta { font-size: 0.85rem; color: #7f1d1d; margin-bottom: 1rem; }
                .alert-actions { display: flex; gap: 0.75rem; }
                .btn-validate {
                    background: #16a34a; color: white; border: none; padding: 0.4rem 1rem;
                    border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem;
                }
                .btn-reject {
                    background: #dc2626; color: white; border: none; padding: 0.4rem 1rem;
                    border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem;
                }
                .alert-resolved {
                    background: #dcfce7; color: #166534; display: inline-block;
                    padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.8rem;
                }

                /* Records Container */
                .records-container {
                    background: white;
                    border-radius: 20px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
                    border: 1px solid #e2e8f0;
                    margin-bottom: 2rem;
                }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .section-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
                .btn-refresh {
                    background: white; border: 1px solid #e2e8f0; color: #475569;
                    padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .btn-refresh:hover { background: #f8fafc; border-color: #cbd5e1; color: #1e293b; }

                /* Table */
                .table-responsive { overflow-x: auto; }
                .custom-table { width: 100%; border-collapse: separate; border-spacing: 0; }
                .custom-table th {
                    text-align: left; padding: 1rem; border-bottom: 2px solid #e2e8f0;
                    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;
                }
                .custom-table td { padding: 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; color: #334155; }
                .custom-table tr:last-child td { border-bottom: none; }
                .text-gray { color: #94a3b8; font-family: monospace; }
                .font-medium { font-weight: 600; color: #0f172a; }
                .capitalize { text-transform: capitalize; }
                .truncate-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .text-center { text-align: center; }
                .action-buttons { display: flex; justify-content: center; gap: 0.5rem; }
                .btn-icon {
                    width: 32px; height: 32px; border-radius: 8px; border: 1px solid;
                    display: flex; align-items: center; justify-content: center; cursor: pointer;
                    font-size: 1rem; transition: transform 0.1s;
                }
                .btn-icon:hover { transform: scale(1.1); }
                .btn-check { background: #f0fdf4; border-color: #bbf7d0; color: #16a34a; }
                .btn-cross { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

                /* History */
                .history-container {
                    background: white; border-radius: 20px; padding: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;
                }
                .toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; color: #64748b; }
                .logs-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .log-item {
                    padding: 1rem; border-radius: 10px; border: 1px solid #e2e8f0;
                    background: #f9fafb; transition: all 0.2s;
                }
                .log-item.fraude_detectado { background: #fef2f2; border-color: #fca5a5; }
                .log-item.validacion { background: #f0fdf4; border-color: #bbf7d0; }
                .log-content { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
                .log-main { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
                .log-badge {
                    font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 6px;
                    color: white; text-transform: uppercase;
                }
                .log-badge.fraude_detectado { background: #dc2626; }
                .log-badge.validacion { background: #16a34a; }
                .log-badge.sync { background: #3b82f6; }
                .log-message { font-size: 0.9rem; font-weight: 500; color: #1f2937; }
                .log-date { font-size: 0.8rem; color: #9ca3af; white-space: nowrap; }
                .log-footer { font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; font-style: italic; }

                /* Common */
                .empty-state { text-align: center; padding: 3rem 1rem; }
                .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; color: #22c55e; }
                .spinner-lg {
                    width: 36px; height: 36px; border: 3px solid #e2e8f0;
                    border-top-color: #6366f1; border-radius: 50%;
                    animation: spin 0.8s linear infinite; margin: 0 auto 1rem;
                }
                .alert-success-custom {
                    background: #dcfce7; border: 1px solid #86efac; color: #166534;
                    padding: 0.75rem 1rem; border-radius: 10px; margin-bottom: 1rem; font-weight: 600;
                }
                .alert-error-custom {
                    background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b;
                    padding: 0.75rem 1rem; border-radius: 10px; margin-bottom: 1rem; font-weight: 600;
                }

                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.7; }
                }
                
                @media (max-width: 768px) {
                    .main-content { padding: 24px 16px; }
                    .header-container { flex-direction: column; align-items: flex-start; }
                    .header-stats { width: 100%; }
                    .stat-card { flex: 1; }
                }
            `}</style>
        </div>
    );
}
