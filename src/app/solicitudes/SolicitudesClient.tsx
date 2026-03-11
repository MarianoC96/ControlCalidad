'use client';

import Head from 'next/head';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';


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
    resuelto_por: {
        nombre_completo: string;
        usuario: string;
    } | null;
    origen?: 'calidad' | 'escaneo';
    scan_mode?: 'productos' | 'cajas';
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
        origen: string;
    }>({ show: false, type: 'aprobar', requestId: null, userName: '', productName: '', origen: 'calidad' });

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');
    const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');

    const MONTH_ABBREVIATIONS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'] as const;

    const buildDisplayId = (req: EditRequest): string => {
        const monthIndex = new Date(req.created_at).getMonth();
        const monthAbbr = MONTH_ABBREVIATIONS[monthIndex];
        return `S-${monthAbbr}${String(req.id).padStart(4, '0')}`;
    };

    const buildHistorialId = (req: EditRequest): string => {
        const d = new Date(req.registros.fecha_registro);
        const mes = MONTH_ABBREVIATIONS[d.getMonth()];
        return `${mes}${String(req.registro_id).padStart(4, '0')}`;
    };

    const [realtimeNotification, setRealtimeNotification] = useState<{ show: boolean; message: string } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        checkAuth();
        loadRequests();

        // 🔊 Setup notification sound
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

        // 🔥 Realtime Subscription
        const supabase = createClient();
        const channel = supabase
            .channel('edit_requests_changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'edit_requests'
                },
                (payload) => {
                    console.log('Realtime change detected:', payload);

                    // Reload data to ensure everything is fresh
                    loadRequests();

                    // If it's a new request, show notification
                    if (payload.eventType === 'INSERT') {
                        // Play sound
                        audioRef.current?.play().catch(() => { });

                        // Show toast
                        setRealtimeNotification({
                            show: true,
                            message: '¡Nueva solicitud de edición recibida!'
                        });

                        // Hide toast after 5 seconds
                        setTimeout(() => {
                            setRealtimeNotification(null);
                        }, 5000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredRequests = requests.filter(req => {
        const displayId = buildDisplayId(req);
        const normalizedSearch = searchTerm.toLowerCase();

        // Filtrado por Pestaña
        const matchesTab = activeTab === 'pendientes'
            ? req.status === 'pendiente'
            : (req.status === 'aprobado' || req.status === 'rechazado' || req.status === 'usado');

        if (!matchesTab) return false;

        const matchesSearch =
            req.usuarios.nombre_completo.toLowerCase().includes(normalizedSearch) ||
            req.usuarios.usuario.toLowerCase().includes(normalizedSearch) ||
            req.registros.producto_nombre.toLowerCase().includes(normalizedSearch) ||
            displayId.toLowerCase().includes(normalizedSearch);

        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

        let matchesDate = true;
        if (dateFilter) {
            const peruDate = new Date(req.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
            matchesDate = peruDate === dateFilter;
        }
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
        if (user.roles !== 'administrador' && !user.hasSolicitudesPermission) {
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
            productName: req.registros.producto_nombre,
            origen: req.origen || 'calidad'
        });
    };

    // Función para ejecutar la acción después de confirmar
    const executeAction = async () => {
        if (!confirmModal.requestId) return;
        const id = confirmModal.requestId;
        const status = confirmModal.type === 'aprobar' ? 'aprobado' : 'rechazado';
        const origen = confirmModal.origen;

        setConfirmModal({ ...confirmModal, show: false });
        setActionLoading(id);

        try {
            const response = await fetch('/api/admin/edit-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, origen })
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
    if (loading) return <LoadingOverlay message="Sincronizando Solicitudes..." />;

    return (
        <div className="admin-page-wrapper">


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
                    {/* Tabs Navigation */}
                    <div className="tabs-container">
                        <button
                            className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('pendientes');
                                setStatusFilter('all');
                            }}
                        >
                            <i className="bi bi-clock-history"></i>
                            Pendientes
                            <span className="count-badge">{requests.filter(r => r.status === 'pendiente').length}</span>
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('historial');
                                setStatusFilter('all');
                            }}
                        >
                            <i className="bi bi-journal-text"></i>
                            Historial
                        </button>
                    </div>

                    <div className="card-body p-4">

                        {/* Toolbar */}
                        {/* Toolbar */}
                        <div className="toolbar-row">
                            {/* Left Side: Search */}
                            <div className="toolbar-search">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="search-icon" viewBox="0 0 16 16">
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
                            <div className="toolbar-filters">
                                {activeTab === 'historial' && (
                                    <select
                                        className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="all">Todos los resueltos</option>
                                        <option value="aprobado">Solo Aprobados</option>
                                        <option value="rechazado">Solo Rechazados</option>
                                        <option value="usado">Solo Usados</option>
                                    </select>
                                )}
                                <div style={{ position: 'relative', width: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        readOnly
                                        className="form-control form-control-sm rounded-pill border-secondary-subtle bg-light text-secondary shadow-none"
                                        value={dateFilter ? dateFilter.split('-').reverse().join('/') : ''}
                                        placeholder="DD/MM/AAAA"
                                        onClick={(e) => {
                                            const hiddenInput = (e.target as HTMLElement).parentElement?.querySelector('input[type="date"]') as HTMLInputElement;
                                            hiddenInput?.showPicker?.();
                                        }}
                                        style={{ width: '145px', cursor: 'pointer', paddingRight: dateFilter ? '30px' : '12px' }}
                                    />
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                        tabIndex={-1}
                                    />
                                    {dateFilter && (
                                        <button
                                            type="button"
                                            onClick={() => setDateFilter('')}
                                            style={{
                                                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                fontSize: '1rem', color: '#6c757d', lineHeight: 1
                                            }}
                                            title="Limpiar fecha"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table Content */}
                        {/* Desktop Table */}
                        <div className="desktop-table">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0 align-middle">
                                    <thead className="table-light text-secondary text-uppercase small">
                                        <tr>
                                            <th className="ps-3 fw-semibold text-secondary">ID</th>
                                            <th className="fw-semibold text-secondary">ID Historial</th>
                                            <th className="fw-semibold text-secondary">Usuario</th>
                                            <th className="fw-semibold text-secondary">Producto</th>
                                            <th className="fw-semibold text-secondary">Lote</th>
                                            <th className="fw-semibold text-secondary">Fecha</th>
                                            <th className="fw-semibold text-secondary">Motivo</th>
                                            <th className="fw-semibold text-secondary">Origen</th>
                                            <th className="fw-semibold text-secondary">Aprobado por</th>
                                            <th className="text-end pe-3 fw-semibold text-secondary">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-5">
                                                    <div className="spinner-border text-primary" role="status">
                                                        <span className="visually-hidden">Cargando...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="text-center py-5 text-muted">
                                                    No hay solicitudes que coincidan con los filtros.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRequests.map((req) => (
                                                <tr key={req.id} className={req.status === 'pendiente' ? 'table-warning' : ''}>
                                                    <td className="ps-3 fw-bold text-primary" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{buildDisplayId(req)}</td>
                                                    <td className="fw-bold text-secondary" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{buildHistorialId(req)}</td>
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
                                                    <td className="text-dark" style={{ fontSize: '0.9rem' }}>
                                                        {req.registros.producto_nombre}
                                                    </td>
                                                    <td className="fw-bold text-dark">{req.registros.lote_interno}</td>
                                                    <td className="text-muted small">{new Date(req.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</td>
                                                    <td className="text-dark" style={{ fontSize: '0.85rem', maxWidth: '200px' }}>
                                                        {req.motivo ? (
                                                            <span style={{ lineHeight: '1.4' }}>{req.motivo}</span>
                                                        ) : (
                                                            <span className="text-muted small">—</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center align-middle">
                                                        {req.origen === 'escaneo' ? (
                                                            <span className="badge bg-info bg-opacity-10 text-info border border-info rounded-pill px-2 py-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                                                <i className="bi bi-upc-scan me-1"></i> Escaneo
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary rounded-pill px-2 py-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                                                <i className="bi bi-box-seam me-1"></i> Calidad
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {req.resuelto_por ? (
                                                            <div>
                                                                <div className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>{req.resuelto_por.nombre_completo}</div>
                                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>@{req.resuelto_por.usuario}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted small">—</span>
                                                        )}
                                                    </td>
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
                                                        ) : req.status === 'aprobado' || req.status === 'usado' ? (
                                                            <span className="fw-bold" style={{ color: '#198754', fontSize: '0.85rem' }}>✓ Aprobado</span>
                                                        ) : req.status === 'rechazado' ? (
                                                            <span className="fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem' }}>✗ Rechazado</span>
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
                        </div>

                        {/* Mobile Cards */}
                        <div className="mobile-cards">
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Cargando...</span>
                                    </div>
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    No hay solicitudes que coincidan con los filtros.
                                </div>
                            ) : (
                                filteredRequests.map(req => (
                                    <div key={req.id} className={`mobile-card ${req.status === 'pendiente' ? 'border-warning' : ''}`}>
                                        <div className="mobile-card-header">
                                            <div className="d-flex align-items-center gap-2">
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    {req.usuarios.nombre_completo.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="fw-bold text-primary" style={{ fontSize: '0.8rem' }}>{buildDisplayId(req)}</div>
                                                        <div className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>Hist: {buildHistorialId(req)}</div>
                                                    </div>
                                                    <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{req.usuarios.nombre_completo}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mobile-card-body">
                                            <div className="mobile-card-row">
                                                <span className="label">Motivo:</span>
                                                <span className="value" style={{ fontSize: '0.8rem' }}>{req.motivo || '—'}</span>
                                            </div>
                                            <div className="mobile-card-row">
                                                <span className="label">Origen:</span>
                                                <span className="value">
                                                    {req.origen === 'escaneo' ? (
                                                        <span className="badge bg-info bg-opacity-10 text-info border border-info rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>
                                                            <i className="bi bi-upc-scan me-1"></i> Escaneo
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>
                                                            <i className="bi bi-box-seam me-1"></i> Calidad
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="mobile-card-row">
                                                <span className="label">Producto:</span>
                                                <span className="value">
                                                    {req.registros.producto_nombre}
                                                </span>
                                            </div>
                                            <div className="mobile-card-row">
                                                <span className="label">Lote:</span>
                                                <span className="value">{req.registros.lote_interno}</span>
                                            </div>
                                            <div className="mobile-card-row">
                                                <span className="label">Fecha:</span>
                                                <span className="value">{new Date(req.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</span>
                                            </div>
                                            {req.resuelto_por && (
                                                <div className="mobile-card-row">
                                                    <span className="label">Aprobado por:</span>
                                                    <span className="value">{req.resuelto_por.nombre_completo} - @{req.resuelto_por.usuario}</span>
                                                </div>
                                            )}
                                        </div>
                                        {req.status === 'pendiente' ? (
                                            <div className="mobile-card-actions">
                                                <button
                                                    className="mobile-action-btn approve"
                                                    onClick={() => openConfirmModal(req, 'aprobar')}
                                                    disabled={actionLoading === req.id}
                                                >
                                                    Aprobar
                                                </button>
                                                <button
                                                    className="mobile-action-btn reject"
                                                    onClick={() => openConfirmModal(req, 'rechazar')}
                                                    disabled={actionLoading === req.id}
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mobile-card-actions">
                                                {(req.status === 'aprobado' || req.status === 'usado') && (
                                                    <span className="fw-bold" style={{ color: '#198754', fontSize: '0.85rem', padding: '6px 0' }}>✓ Aprobado</span>
                                                )}
                                                {req.status === 'rechazado' && (
                                                    <span className="fw-bold" style={{ color: '#dc3545', fontSize: '0.85rem', padding: '6px 0' }}>✗ Rechazado</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
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

            {/* REALTIME TOAST NOTIFICATION */}
            {realtimeNotification?.show && (
                <div className="realtime-toast" onClick={() => setRealtimeNotification(null)}>
                    <div className="toast-content">
                        <div className="toast-icon">
                            <i className="bi bi-bell-fill"></i>
                        </div>
                        <div className="toast-text">
                            <span className="toast-title">Nueva Notificación</span>
                            <span className="toast-msg">{realtimeNotification.message}</span>
                        </div>
                        <button className="toast-close">&times;</button>
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
                    max-width: 1200px;
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

                /* Premium Tabs */
                .tabs-container {
                    display: flex;
                    padding: 20px 24px 0;
                    border-bottom: 1px solid #e2e8f0;
                    gap: 8px;
                }

                .tab-btn {
                    padding: 12px 24px;
                    border: none;
                    background: none;
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: #64748b;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-radius: 12px 12px 0 0;
                }

                .tab-btn i { font-size: 1.1rem; }

                .tab-btn:hover {
                    color: #1e293b;
                    background: #f8fafc;
                }

                .tab-btn.active {
                    color: #2563eb;
                    background: white;
                }

                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: #2563eb;
                    border-radius: 3px 3px 0 0;
                }

                .count-badge {
                    background: #fee2e2;
                    color: #ef4444;
                    padding: 2px 8px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 800;
                }

                .tab-btn.active .count-badge {
                    background: #2563eb;
                    color: white;
                }

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
                    z-index: 2000;
                    padding: 20px;
                    backdrop-filter: blur(4px);
                }

                /* Realtime Toast Styles */
                .realtime-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 3000;
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                    border-left: 4px solid #2563eb;
                    cursor: pointer;
                    animation: slideInRight 0.3s ease-out;
                    min-width: 280px;
                    border: 1px solid #e2e8f0;
                }

                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .toast-icon {
                    width: 40px;
                    height: 40px;
                    background: #eff6ff;
                    color: #2563eb;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    animation: bell-shake 0.5s ease-in-out infinite alternate;
                }

                @keyframes bell-shake {
                    from { transform: rotate(-10deg); }
                    to { transform: rotate(10deg); }
                }

                .toast-text {
                    display: flex;
                    flex-direction: column;
                }

                .toast-title {
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 0.9rem;
                }

                .toast-msg {
                    color: #64748b;
                    font-size: 0.8rem;
                }

                .toast-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 1.2rem;
                    margin-left: auto;
                    padding: 0 4px;
                }
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    padding: 20px;
                    backdrop-filter: blur(4px);
                }

                /* Realtime Toast Styles */
                .realtime-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 3000;
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                    border-left: 4px solid #2563eb;
                    cursor: pointer;
                    animation: slideInRight 0.3s ease-out;
                    min-width: 280px;
                    border-bottom: 1px solid #e2e8f0;
                    border-top: 1px solid #e2e8f0;
                    border-right: 1px solid #e2e8f0;
                }

                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .toast-icon {
                    width: 40px;
                    height: 40px;
                    background: #eff6ff;
                    color: #2563eb;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    animation: bell-shake 0.5s ease-in-out infinite alternate;
                }

                @keyframes bell-shake {
                    from { transform: rotate(-10deg); }
                    to { transform: rotate(10deg); }
                }

                .toast-text {
                    display: flex;
                    flex-direction: column;
                }

                .toast-title {
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 0.9rem;
                }

                .toast-msg {
                    color: #64748b;
                    font-size: 0.8rem;
                }

                .toast-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 1.2rem;
                    margin-left: auto;
                    padding: 0 4px;
                }
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    padding: 20px;
                    backdrop-filter: blur(4px);
                }

                /* Realtime Toast Styles */
                .realtime-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 3000;
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                    border-left: 4px solid #2563eb;
                    cursor: pointer;
                    animation: slideInRight 0.3s ease-out;
                    min-width: 280px;
                }

                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .toast-icon {
                    width: 40px;
                    height: 40px;
                    background: #eff6ff;
                    color: #2563eb;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    animation: bell-shake 0.5s ease-in-out infinite alternate;
                }

                @keyframes bell-shake {
                    from { transform: rotate(-10deg); }
                    to { transform: rotate(10deg); }
                }

                .toast-text {
                    display: flex;
                    flex-direction: column;
                }

                .toast-title {
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 0.9rem;
                }

                .toast-msg {
                    color: #64748b;
                    font-size: 0.8rem;
                }

                .toast-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 1.2rem;
                    margin-left: auto;
                    padding: 0 4px;
                }
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

                /* Toolbar */
                .toolbar-row {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #dee2e6;
                    gap: 12px;
                }
                .toolbar-filters {
                    display: flex;
                    flex-direction: row;
                    gap: 10px;
                    align-items: center;
                }
                .toolbar-search {
                    width: 300px;
                    min-width: 200px;
                    position: relative;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 10;
                    color: #6c757d;
                }

                /* Layout Toggles */
                .desktop-table { display: block; width: 100%; }
                .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .mobile-cards { display: none; }

                /* Mobile Card Styles */
                .mobile-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                }
                .mobile-card.border-warning { border-color: #fbbf24; border-left-width: 4px; }
                
                .mobile-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .mobile-card-body {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .mobile-card-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                }
                .mobile-card-row .label { color: #64748b; font-weight: 500; }
                .mobile-card-row .value { color: #1e293b; font-weight: 600; text-align: right; }
                
                .mobile-card-actions {
                    display: flex;
                    gap: 8px;
                }
                .mobile-action-btn {
                    flex: 1;
                    padding: 10px 0;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .mobile-action-btn.approve { background: #10b981; color: white; }
                .mobile-action-btn.reject { background: #fee2e2; color: #991b1b; }
                .mobile-action-btn:disabled { opacity: 0.5; }

                @media (max-width: 768px) {
                    /* Header Compacto */
                    .header-container { 
                        flex-direction: column; 
                        text-align: center; 
                        gap: 16px; 
                        padding: 24px 16px !important;
                        border-radius: 20px; 
                    }
                    .title { font-size: 1.5rem !important; }
                    .subtitle { font-size: 0.85rem !important; margin-top: 4px; }
                    
                    /* Stats Horizontales */
                    .header-stats { 
                        width: 100%; 
                        justify-content: space-between; 
                        gap: 10px; 
                    }
                    .stat-pill {
                        flex: 1;
                        flex-direction: row;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        padding: 8px 10px;
                    }
                    .stat-pill .val { font-size: 1.1rem; }
                    .stat-pill .lab { font-size: 0.65rem; text-align: left; line-height: 1.1; }

                    /* Toolbar Stacks */
                    .toolbar-row { flex-direction: column; gap: 12px; align-items: stretch; margin-bottom: 1rem; padding-bottom: 1rem; }
                    .toolbar-search { width: 100%; }
                    .toolbar-filters { width: 100%; gap: 8px; }
                    .toolbar-filters select, .toolbar-filters input { 
                        flex: 1; 
                        width: 100% !important; 
                        height: 42px; /* Touch target */
                    }
                    
                    /* Table -> Cards */
                    .desktop-table { display: none !important; }
                    .mobile-cards { display: block !important; }
                    
                    .mobile-cards > .text-center {
                        background: #f8fafc;
                        border: 2px dashed #e2e8f0;
                        border-radius: 16px;
                        padding: 32px 20px !important;
                        margin-top: 10px;
                        font-size: 0.95rem;
                    }
                    
                    .confirm-actions { flex-direction: column; }
                }
            `}</style>
        </div>
    );
}
