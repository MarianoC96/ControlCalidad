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

    const handleAction = async (id: number, status: 'aprobado' | 'rechazado') => {
        if (!confirm(`¿Estás seguro de que deseas ${status === 'aprobado' ? 'APROBAR' : 'RECHAZAR'} esta solicitud?`)) return;
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
                {/* Header Section - Better contrast and contained */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system">
                            <span className="dot-pulse"></span>
                            SISTEMA DE GESTIÓN
                        </div>
                        <h1 className="title">Solicitudes de Edición</h1>
                        <p className="subtitle">Administre las peticiones de cambios extraordinarios de forma segura.</p>
                    </div>

                    <div className="header-stats">
                        <div className="stat-box">
                            <div className="stat-value text-primary">{requests.filter(r => r.status === 'pendiente').length}</div>
                            <div className="stat-label">PENDIENTES</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value text-dark">{requests.length}</div>
                            <div className="stat-label">TOTAL</div>
                        </div>
                    </div>
                </div>

                {/* Filters - High Contrast */}
                <div className="filters-bar shadow-sm">
                    <div className="search-input-group">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            placeholder="Buscar personal o producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Todos los estados</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="aprobado">Aprobados</option>
                        <option value="rechazado">Rechazados</option>
                    </select>
                    <input
                        type="date"
                        className="filter-date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    />
                </div>

                {/* Feed Section */}
                <div className="requests-feed">
                    {loading ? (
                        <div className="spinner-container">
                            <div className="spinner-glow"></div>
                            <p>SINCRONIZANDO...</p>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="empty-state shadow-sm border">
                            <i className="bi bi-clipboard-x"></i>
                            <h5>Sin coincidencias</h5>
                            <button className="btn-link" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateFilter(''); }}>
                                Restablecer filtros
                            </button>
                        </div>
                    ) : (
                        <div className="feed-list">
                            {filteredRequests.map((req) => (
                                <div key={req.id} className={`request-item shadow-sm border ${req.status === 'pendiente' ? 'pending-border' : ''}`}>
                                    <div className="item-layout">
                                        <div className="user-col">
                                            <div className="avatar">{req.usuarios.nombre_completo.charAt(0)}</div>
                                            <div className="user-info">
                                                <div className="user-name">{req.usuarios.nombre_completo}</div>
                                                <div className="user-tag">@{req.usuarios.usuario} • {new Date(req.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>

                                        <div className="product-col">
                                            <div className="product-name">{req.registros.producto_nombre}</div>
                                            <div className="product-lote">Lote: <span>{req.registros.lote_interno}</span></div>
                                        </div>

                                        <div className="actions-col">
                                            {req.status === 'pendiente' ? (
                                                <div className="action-buttons">
                                                    <button className="btn-approve" onClick={() => handleAction(req.id, 'aprobado')} disabled={actionLoading === req.id}>
                                                        {actionLoading === req.id ? '...' : 'Aprobar'}
                                                    </button>
                                                    <button className="btn-reject" onClick={() => handleAction(req.id, 'rechazado')} disabled={actionLoading === req.id}>
                                                        Rechazar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="status-display">
                                                    {getStatusBadge(req.status)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {req.motivo && (
                                        <div className="reason-bubble" onClick={() => setViewingMotivo(req.motivo)}>
                                            <i className="bi bi-chat-dots me-2"></i>
                                            "{req.motivo}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
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
                    color: #0369a1;
                    padding: 4px 12px;
                    border-radius: 50px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    margin-bottom: 12px;
                }

                .dot-pulse {
                    width: 8px;
                    height: 8px;
                    background: #0369a1;
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

                .header-stats { display: flex; gap: 16px; }
                .stat-box { background: #f8fafc; padding: 12px 20px; border-radius: 16px; text-align: center; min-width: 100px; border: 1px solid #e2e8f0; }
                .stat-value { font-size: 1.4rem; font-weight: 900; line-height: 1; }
                .stat-label { font-size: 0.65rem; font-weight: 700; color: #94a3b8; margin-top: 4px; }

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
                .btn-approve { background: #10b981; color: white; border: none; border-radius: 50px; padding: 8px 20px; font-weight: 700; font-size: 0.85rem; }
                .btn-reject { background: transparent; color: #ef4444; border: 1px solid #fee2e2; border-radius: 50px; padding: 8px 20px; font-weight: 700; font-size: 0.85rem; }

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

                @media (max-width: 768px) {
                    .header-container { flex-direction: column; text-align: center; gap: 20px; }
                    .item-layout { flex-direction: column; gap: 16px; text-align: center; }
                    .product-col { border: none; padding: 10px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; width: 100%; }
                    .actions-col { padding: 0; width: 100%; }
                    .action-buttons { flex-direction: row; justify-content: center; }
                }
            `}</style>
        </div>
    );
}
