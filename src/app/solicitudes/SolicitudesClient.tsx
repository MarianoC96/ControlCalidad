'use client';

import Head from 'next/head';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface EditRequest {
    id: number;
    registro_id: number;
    usuario_id: number;
    status: 'pendiente' | 'aprobado' | 'rechazado' | 'usado';
    motivo: string | null;
    created_at: string;
    resolved_at: string | null;
    registros: {
        lote_interno: string;
        producto_nombre: string;
        fecha_registro: string;
    };
    usuarios: {
        nombre_completo: string;
        usuario: string;
    };
}

export default function SolicitudesClient() {
    const router = useRouter();
    const [requests, setRequests] = useState<EditRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [viewingMotivo, setViewingMotivo] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        type: 'aprobar' | 'rechazar';
        requestId: number | null;
        userName: string;
        productName: string;
    }>({ show: false, type: 'aprobar', requestId: null, userName: '', productName: '' });

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        checkAuth();
        loadRequests();
    }, []);

    const filteredRequests = requests.filter(req => {
        const matchesSearch =
            req.usuarios.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.usuarios.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.registros.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
        const matchesDate = !dateFilter || req.created_at.startsWith(dateFilter);
        return matchesSearch && matchesStatus && matchesDate;
    });

    const checkAuth = async () => {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            router.push('/');
            return;
        }
        const user = await response.json();
        setUserName(user.nombre_completo);
        setUserRole(user.roles);
        if (user.roles !== 'administrador') {
            router.push('/historial');
        }
    };

    const loadRequests = async () => {
        try {
            const response = await fetch('/api/admin/edit-requests');
            if (response.ok) {
                const data = await response.json();
                setRequests(data);
            }
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setLoading(false);
        }
    };

    // Función para abrir el modal de confirmación
    const openConfirmModal = (req: EditRequest, type: 'aprobar' | 'rechazar') => {
        setConfirmModal({
            show: true,
            type,
            requestId: req.id,
            userName: req.usuarios.nombre_completo,
            productName: req.registros.producto_nombre
        });
    };

    // Función para ejecutar la acción después de confirmar
    const executeAction = async () => {
        if (!confirmModal.requestId) return;
        const id = confirmModal.requestId;
        const status = confirmModal.type === 'aprobar' ? 'aprobado' : 'rechazado';

        setConfirmModal({ ...confirmModal, show: false });
        setActionLoading(id);

        try {
            const response = await fetch('/api/admin/edit-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            if (response.ok) loadRequests();
            else alert('Error al procesar la solicitud');
        } catch (error) {
            console.error('Action error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pendiente': return <span className="custom-badge badge-pending">Pendiente</span>;
            case 'aprobado': return <span className="custom-badge badge-approved">Aprobado</span>;
            case 'rechazado': return <span className="custom-badge badge-rejected">Rechazado</span>;
            case 'usado': return <span className="custom-badge badge-used">Usado (1/1)</span>;
            default: return <span className="custom-badge bg-secondary text-white">{status}</span>;
        }
    };

    return (
        <div className="admin-page-wrapper">
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <main className="main-content">
                {/* Header Premium */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system"><span className="dot-pulse"></span>ADMINISTRACIÓN</div>
                        <h1 className="title">Solicitudes de Edición</h1>
                        <p className="subtitle">Gestione las peticiones de cambios extraordinarios de forma segura.</p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-pill pending">
                            <span className="val">{requests.filter(r => r.status === 'pendiente').length}</span>
                            <span className="lab">PENDIENTES</span>
                        </div>
                        <div className="stat-pill">
                            <span className="val">{requests.length}</span>
                            <span className="lab">TOTAL</span>
                        </div>
                    </div>
                </div>

                <div className="card shadow-sm border-0 bg-white" style={{ borderRadius: '12px', minHeight: '600px' }}>
                    <div className="card-body p-4">

                        {/* Toolbar */}
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #dee2e6' }}>
                            {/* Left Side: Search */}
                            <div style={{ width: '300px', position: 'relative' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="text-secondary" viewBox="0 0 16 16" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
                                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                                </svg>
                                <input
                                    type="text"
                                    className="form-control border-secondary-subtle rounded-pill text-secondary shadow-none bg-light"
                                    placeholder="Buscar personal o producto..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ fontSize: '0.9rem', backgroundColor: '#f8f9fa', paddingLeft: '35px' }}
                                />
                            </div>

                            {/* Right Side: Filters */}
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
                                <select
                                    className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    style={{ width: 'auto' }}
                                >
                                    <option value="all">Todos los estados</option>
                                    <option value="pendiente">Pendientes</option>
                                    <option value="aprobado">Aprobados</option>
                                    <option value="rechazado">Rechazados</option>
                                </select>
                                <input
                                    type="date"
                                    className="form-control form-control-sm rounded-pill border-secondary-subtle bg-light text-secondary shadow-none"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    style={{ width: 'auto' }}
                                />
                            </div>
                        </div>

                        {/* Table Content */}
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light text-secondary text-uppercase small">
                                    <tr>
                                        <th className="ps-3 fw-semibold text-secondary">Usuario</th>
                                        <th className="fw-semibold text-secondary">Producto</th>
                                        <th className="fw-semibold text-secondary">Lote</th>
                                        <th className="fw-semibold text-secondary">Fecha</th>
                                        <th className="fw-semibold text-secondary">Estado</th>
                                        <th className="text-end pe-3 fw-semibold text-secondary">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-5">
                                                <div className="spinner-border text-primary" role="status">
                                                    <span className="visually-hidden">Cargando...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-5 text-muted">
                                                No hay solicitudes que coincidan con los filtros.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRequests.map((req) => (
                                            <tr key={req.id} className={req.status === 'pendiente' ? 'table-warning' : ''}>
                                                <td className="ps-3">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                                                            {req.usuarios.nombre_completo.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{req.usuarios.nombre_completo}</div>
                                                            <div className="text-muted small">@{req.usuarios.usuario}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-dark" style={{ fontSize: '0.9rem' }}>{req.registros.producto_nombre}</td>
                                                <td className="fw-bold text-dark">{req.registros.lote_interno}</td>
                                                <td className="text-muted small">{new Date(req.created_at).toLocaleDateString('es-PE')}</td>
                                                <td>{getStatusBadge(req.status)}</td>
                                                <td className="text-end pe-3">
                                                    {req.status === 'pendiente' ? (
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <button
                                                                className="btn btn-sm btn-success rounded-pill px-3"
                                                                onClick={() => openConfirmModal(req, 'aprobar')}
                                                                disabled={actionLoading === req.id}
                                                                style={{ fontSize: '0.8rem' }}
                                                            >
                                                                {actionLoading === req.id ? (
                                                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                                                ) : 'Aprobar'}
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                                                onClick={() => openConfirmModal(req, 'rechazar')}
                                                                disabled={actionLoading === req.id}
                                                                style={{ fontSize: '0.8rem' }}
                                                            >
                                                                Rechazar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted small">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        {filteredRequests.length > 0 && (
                            <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                                <span className="small text-muted">
                                    Mostrando {filteredRequests.length} de {requests.length} solicitudes
                                </span>
                                {(searchTerm || statusFilter !== 'all' || dateFilter) && (
                                    <button
                                        className="btn btn-sm btn-link text-decoration-none"
                                        onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateFilter(''); }}
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </main>

            {/* Modal - Plain Background */}
            {viewingMotivo && (
                <div className="custom-modal" onClick={() => setViewingMotivo(null)}>
                    <div className="modal-box shadow-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5>Detalle del Motivo</h5>
                            <button className="close-btn" onClick={() => setViewingMotivo(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p>"{viewingMotivo}"</p>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN PREMIUM */}
            {confirmModal.show && (
                <div className="confirm-overlay" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>
                    <div className={`confirm-modal ${confirmModal.type}`} onClick={e => e.stopPropagation()}>
                        {/* Icono animado */}
                        <div className={`confirm-icon-wrapper ${confirmModal.type}`}>
                            <div className="confirm-icon-bg"></div>
                            {confirmModal.type === 'aprobar' ? (
                                <svg className="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                            ) : (
                                <svg className="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>

                        {/* Contenido */}
                        <div className="confirm-content">
                            <h3 className="confirm-title">
                                {confirmModal.type === 'aprobar' ? '¿Aprobar Solicitud?' : '¿Rechazar Solicitud?'}
                            </h3>
                            <p className="confirm-subtitle">
                                {confirmModal.type === 'aprobar'
                                    ? 'El usuario podrá editar el registro una vez.'
                                    : 'Esta acción no se puede deshacer.'}
                            </p>

                            {/* Info card */}
                            <div className="confirm-info-card">
                                <div className="info-row">
                                    <span className="info-label">Usuario</span>
                                    <span className="info-value">{confirmModal.userName}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Producto</span>
                                    <span className="info-value">{confirmModal.productName}</span>
                                </div>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="confirm-actions">
                            <button
                                className="confirm-btn-cancel"
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                            >
                                Cancelar
                            </button>
                            <button
                                className={`confirm-btn-action ${confirmModal.type}`}
                                onClick={executeAction}
                            >
                                {confirmModal.type === 'aprobar' ? (
                                    <><i className="bi bi-check-lg"></i> Sí, Aprobar</>
                                ) : (
                                    <><i className="bi bi-x-lg"></i> Sí, Rechazar</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .admin-page-wrapper {
                    min-height: 100vh;
                    background-color: #f4f7f9;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                }

                .main-content {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }

                /* Header - High Contrast White Card */
                .header-container {
                    background: white;
                    border-radius: 24px;
                    padding: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .header-info .badge-system {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: #e0f2fe;
                    color: #2563eb;
                    padding: 4px 12px;
                    border-radius: 50px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    margin-bottom: 12px;
                }

                .dot-pulse {
                    width: 8px;
                    height: 8px;
                    background: #2563eb;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(3, 105, 161, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(3, 105, 161, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(3, 105, 161, 0); }
                }

                .title { font-size: 1.8rem; font-weight: 900; color: #1e293b; margin: 0; }
                .subtitle { color: #64748b; font-size: 0.95rem; margin: 8px 0 0; }

                .header-stats { display: flex; gap: 16px; align-items: center; }
                .stat-pill {
                    background: #f8fafc;
                    padding: 8px 15px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                }
                .stat-pill .val { font-weight: 900; font-size: 1.2rem; line-height: 1; color: #1e293b; }
                .stat-pill .lab { font-size: 0.6rem; font-weight: 800; color: #94a3b8; }
                .stat-pill.pending { border-color: #fbbf24; background: #fef3c7; }
                .stat-pill.pending .val { color: #92400e; }

                /* Filter Bar - Modern & Clear */
                .filters-bar {
                    background: white;
                    border-radius: 50px;
                    padding: 10px 20px;
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    margin-bottom: 24px;
                    border: 1px solid #e2e8f0;
                }

                .search-input-group { flex: 1; display: flex; align-items: center; gap: 10px; }
                .search-input-group i { color: #94a3b8; }
                .search-input-group input { border: none; outline: none; width: 100%; font-size: 0.9rem; }

                .filter-select, .filter-date {
                    border: 1px solid #e2e8f0;
                    border-radius: 50px;
                    padding: 6px 15px;
                    font-size: 0.85rem;
                    color: #475569;
                    outline: none;
                }

                /* Request Items */
                .request-item {
                    background: white;
                    border-radius: 20px;
                    padding: 24px;
                    margin-bottom: 16px;
                    transition: transform 0.2s;
                }
                .request-item:hover { transform: translateY(-2px); }
                .pending-border { border-left: 6px solid #ef4444 !important; }

                .item-layout { display: flex; align-items: center; justify-content: space-between; }

                .user-col { display: flex; align-items: center; gap: 16px; flex: 1; }
                .avatar { width: 44px; height: 44px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; }
                .user-name { font-weight: 800; color: #1e293b; font-size: 1rem; }
                .user-tag { color: #94a3b8; font-size: 0.8rem; }

                .product-col { flex: 1; border-left: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; padding: 0 24px; }
                .product-name { font-weight: 700; color: #475569; font-size: 0.9rem; }
                .product-lote { font-size: 0.75rem; color: #94a3b8; }
                .product-lote span { font-weight: 700; color: #64748b; }

                .actions-col { flex-shrink: 0; padding-left: 24px; }
                .action-buttons { display: flex; flex-direction: column; gap: 8px; }
                .btn-approve { background: #10b981; color: white; border: none; border-radius: 50px; padding: 8px 20px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; }
                .btn-approve:hover { background: #059669; transform: translateY(-1px); }
                .btn-reject { background: transparent; color: #ef4444; border: 1px solid #fee2e2; border-radius: 50px; padding: 8px 20px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; }
                .btn-reject:hover { background: #fef2f2; border-color: #fca5a5; }

                .reason-bubble {
                    margin-top: 16px;
                    background: #f1f5f9;
                    padding: 10px 16px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    color: #475569;
                    cursor: pointer;
                    border: 1px solid transparent;
                }
                .reason-bubble:hover { border-color: #cbd5e1; background: #e2e8f0; }

                /* Badges */
                .custom-badge { padding: 4px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 700; }
                .badge-pending { background: #fef3c7; color: #92400e; }
                .badge-approved { background: #d1fae5; color: #065f46; }
                .badge-rejected { background: #fee2e2; color: #991b1b; }
                .badge-used { background: #dbeafe; color: #1e40af; }

                /* Modal */
                .custom-modal { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
                .modal-box { background: white; border-radius: 24px; width: 100%; max-width: 500px; }
                .modal-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .modal-header h5 { margin: 0; font-weight: 800; }
                .close-btn { background: none; border: none; font-size: 1.5rem; color: #94a3b8; }
                .modal-body { padding: 24px; font-size: 1.1rem; color: #334155; font-style: italic; }
                /* MODAL DE CONFIRMACIÓN PREMIUM */
                .confirm-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1100;
                    padding: 20px;
                }

                .confirm-modal {
                    background: white;
                    border-radius: 24px;
                    width: 100%;
                    max-width: 400px;
                    padding: 32px;
                    text-align: center;
                    animation: modalIn 0.2s ease-out;
                }

                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .confirm-icon-wrapper {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }

                .confirm-icon-wrapper.aprobar {
                    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
                }

                .confirm-icon-wrapper.rechazar {
                    background: linear-gradient(135deg, #fee2e2, #fecaca);
                }

                .confirm-icon {
                    width: 40px;
                    height: 40px;
                }

                .confirm-icon-wrapper.aprobar .confirm-icon {
                    color: #059669;
                }

                .confirm-icon-wrapper.rechazar .confirm-icon {
                    color: #dc2626;
                }

                .confirm-content {
                    margin-bottom: 24px;
                }

                .confirm-title {
                    font-size: 1.4rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 0 0 8px;
                }

                .confirm-subtitle {
                    font-size: 0.9rem;
                    color: #64748b;
                    margin: 0 0 20px;
                }

                .confirm-info-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 16px;
                    text-align: left;
                }

                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                }

                .info-row:not(:last-child) {
                    border-bottom: 1px solid #e2e8f0;
                }

                .info-label {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    font-weight: 600;
                }

                .info-value {
                    font-size: 0.85rem;
                    color: #334155;
                    font-weight: 700;
                }

                .confirm-actions {
                    display: flex;
                    gap: 12px;
                }

                .confirm-btn-cancel {
                    flex: 1;
                    padding: 14px 20px;
                    border: 2px solid #e2e8f0;
                    background: white;
                    border-radius: 14px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .confirm-btn-cancel:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }

                .confirm-btn-action {
                    flex: 1;
                    padding: 14px 20px;
                    border: none;
                    border-radius: 14px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: white;
                    cursor: pointer;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .confirm-btn-action.aprobar {
                    background: linear-gradient(135deg, #10b981, #059669);
                }

                .confirm-btn-action.aprobar:hover {
                    background: linear-gradient(135deg, #059669, #047857);
                    transform: translateY(-1px);
                }

                .confirm-btn-action.rechazar {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                }

                .confirm-btn-action.rechazar:hover {
                    background: linear-gradient(135deg, #dc2626, #b91c1c);
                    transform: translateY(-1px);
                }

                @media (max-width: 768px) {
                    .header-container { flex-direction: column; text-align: center; gap: 20px; }
                    .item-layout { flex-direction: column; gap: 16px; text-align: center; }
                    .product-col { border: none; padding: 10px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; width: 100%; }
                    .actions-col { padding: 0; width: 100%; }
                    .action-buttons { flex-direction: row; justify-content: center; }
                    .confirm-actions { flex-direction: column; }
                }
            `}</style>
        </div>
    );
}
