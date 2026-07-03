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
        const hasPermission = user.role_permisos?.includes('solicitudes');
        if (!hasPermission) {
            router.push('/control-calidad/historial');
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
            case 'pendiente': return <span className="status-final-premium pendiente"><i className="bi bi-clock"></i> Pendiente</span>;
            case 'aprobado': return <span className="status-final-premium aprobado"><i className="bi bi-check-circle-fill"></i> Aprobado</span>;
            case 'rechazado': return <span className="status-final-premium rechazado"><i className="bi bi-x-circle-fill"></i> Rechazado</span>;
            case 'usado': return <span className="status-final-premium usado"><i className="bi bi-check-circle-fill"></i> Usado (1/1)</span>;
            default: return <span className="status-final-premium">{status}</span>;
        }
    };

    if (loading) return <LoadingOverlay message="Sincronizando Solicitudes..." />;

    return (
        <div className="admin-page-wrapper animate-in">
            {/* Ambient Background Effects */}
            <div className="ambient-background">
                <div className="ambient-sphere-1"></div>
                <div className="ambient-sphere-2"></div>
            </div>

            <main className="main-content relative z-10">
                {/* Header Premium con Navegación */}
                <div className="header-premium-stack">

                    <div className="header-container-premium">
                        <div className="header-info">
                            <div className="badge-system-premium">
                                <span className="dot-pulse"></span>
                                <span className="badge-text">CONTROL DE ACCESO CENTRALIZADO</span>
                            </div>
                            <h1 className="title-premium">Centro de Solicitudes</h1>
                            <p className="subtitle-premium">Validación y auditoría de cambios extraordinarios en registros del sistema.</p>
                        </div>
                        
                        <div className="header-stats-premium">
                            <div className="stat-pill-premium pending">
                                <div className="stat-icon-bg">
                                    <i className="bi bi-clock-history"></i>
                                </div>
                                <div className="stat-content">
                                    <span className="val">{requests.filter(r => r.status === 'pendiente').length}</span>
                                    <span className="lab">PENDIENTES</span>
                                </div>
                            </div>
                            <div className="stat-pill-premium total">
                                <div className="stat-icon-bg">
                                    <i className="bi bi-database-check"></i>
                                </div>
                                <div className="stat-content">
                                    <span className="val">{requests.length}</span>
                                    <span className="lab">REGISTROS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="content-card-premium">
                    {/* Tabs Navigation Premium */}
                    <div className="tabs-container-premium">
                        <button
                            className={`tab-btn-premium ${activeTab === 'pendientes' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('pendientes');
                                setStatusFilter('all');
                            }}
                        >
                            <i className="bi bi-hourglass-split"></i>
                            <span>Por Procesar</span>
                            {requests.filter(r => r.status === 'pendiente').length > 0 && (
                                <span className="count-pill">{requests.filter(r => r.status === 'pendiente').length}</span>
                            )}
                        </button>
                        <button
                            className={`tab-btn-premium ${activeTab === 'historial' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('historial');
                                setStatusFilter('all');
                            }}
                        >
                            <i className="bi bi-archive"></i>
                            <span>Historial Completo</span>
                        </button>
                    </div>

                    <div className="p-6">
                        {/* Toolbar Row */}
                        <div className="toolbar-premium">
                            <div className="search-box-premium">
                                <i className="bi bi-search"></i>
                                <input
                                    type="text"
                                    placeholder="Consultar por usuario, producto o ID (S-JAN...)"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="filter-group-premium">
                                {activeTab === 'historial' && (
                                    <div className="select-wrapper-premium">
                                        <i className="bi bi-filter-right"></i>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                        >
                                            <option value="all">Todos los estados</option>
                                            <option value="aprobado">Solo Aprobados</option>
                                            <option value="rechazado">Solo Rechazados</option>
                                            <option value="usado">Solo Usados</option>
                                        </select>
                                    </div>
                                )}
                                <div className="date-wrapper-premium">
                                    <i className="bi bi-calendar3"></i>
                                    <input
                                        type="text"
                                        readOnly
                                        value={dateFilter ? dateFilter.split('-').reverse().join('/') : ''}
                                        placeholder="Filtrar fecha"
                                        onClick={(e) => {
                                            const hiddenInput = (e.target as HTMLElement).parentElement?.querySelector('input[type="date"]') as HTMLInputElement;
                                            hiddenInput?.showPicker?.();
                                        }}
                                    />
                                    <input
                                        type="date"
                                        className="hidden-date-input"
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                    />
                                    {dateFilter && (
                                        <button className="clear-date-btn" onClick={() => setDateFilter('')}>
                                            <i className="bi bi-x"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contenido Principal */}
                        <div className="desktop-view-premium">
                            <div className="table-responsive-premium custom-scrollbar">
                                <table className="table-premium">
                                    <thead>
                                        <tr>
                                            <th>ID TICKET</th>
                                            <th>USUARIO SOLICITANTE</th>
                                            <th>INFORMACIÓN REGISTRO</th>
                                            <th>DETALLE / MOTIVO</th>
                                            <th>PROVENIENCIA</th>
                                            <th>RESPONSABLE</th>
                                            <th className="text-right">ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-20">
                                                    <div className="empty-state-premium">
                                                        <i className="bi bi-search-heart"></i>
                                                        <h3>Sin coincidencias</h3>
                                                        <p>No se encontraron solicitudes con los criterios actuales.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRequests.map((req) => (
                                                <tr key={req.id} className={`row-premium ${req.status === 'pendiente' ? 'row-highlight' : ''}`}>
                                                    <td>
                                                        <div className="id-badge-premium">
                                                            <span className="id-main">{buildDisplayId(req)}</span>
                                                            <span className="id-sub">REF: {buildHistorialId(req)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="user-profile-premium">
                                                            <div className="avatar-premium">
                                                                {req.usuarios.nombre_completo.charAt(0)}
                                                            </div>
                                                            <div className="user-info">
                                                                <span className="name">{req.usuarios.nombre_completo}</span>
                                                                <span className="handle">@{req.usuarios.usuario}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="record-details-premium">
                                                            <span className="prod-name">{req.registros.producto_nombre}</span>
                                                            <span className="lote-tag">LOTE: <b>{req.registros.lote_interno}</b></span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="reason-container-premium">
                                                            {req.motivo ? (
                                                                <p className="reason-text">"{req.motivo}"</p>
                                                            ) : (
                                                                <span className="no-reason">Sin justificación</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={`origin-pill-premium ${req.origen || 'calidad'}`}>
                                                            {req.origen === 'escaneo' ? <i className="bi bi-upc-scan"></i> : <i className="bi bi-box-seam"></i>}
                                                            <span>{req.origen?.toUpperCase() || 'CALIDAD'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {req.resuelto_por ? (
                                                            <div className="resolver-info-premium">
                                                                <span className="name">{req.resuelto_por.nombre_completo}</span>
                                                                <span className="date">{new Date(req.resolved_at || '').toLocaleDateString('es-PE')}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="unassigned">Pendiente de Revisión</span>
                                                        )}
                                                    </td>
                                                    <td className="text-right">
                                                        {req.status === 'pendiente' ? (
                                                            <div className="action-button-group">
                                                                <button
                                                                    className="btn-action-premium approve"
                                                                    onClick={() => openConfirmModal(req, 'aprobar')}
                                                                    disabled={actionLoading === req.id}
                                                                >
                                                                    {actionLoading === req.id ? <div className="spinner-micro"></div> : <i className="bi bi-check-lg"></i>}
                                                                </button>
                                                                <button
                                                                    className="btn-action-premium reject"
                                                                    onClick={() => openConfirmModal(req, 'rechazar')}
                                                                    disabled={actionLoading === req.id}
                                                                >
                                                                    <i className="bi bi-x-lg"></i>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className={`status-final-premium ${req.status}`}>
                                                                {req.status === 'aprobado' || req.status === 'usado' ? (
                                                                    <><i className="bi bi-check-circle-fill"></i> {req.status === 'usado' ? 'USADO' : 'APROBADO'}</>
                                                                ) : (
                                                                    <><i className="bi bi-x-circle-fill"></i> RECHAZADO</>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile View Premium */}
                        <div className="mobile-view-premium">
                            {filteredRequests.map(req => (
                                <div key={req.id} className={`mobile-card-premium ${req.status}`}>
                                    <div className="m-card-header">
                                        <div className="id-label">{buildDisplayId(req)}</div>
                                        <div className={`origin-pill-premium ${req.origen || 'calidad'}`}>{req.origen === 'escaneo' ? 'Escaneo' : 'Calidad'}</div>
                                    </div>
                                    <div className="m-card-content">
                                        <div className="user-profile-premium mb-3">
                                            <div className="avatar-premium" style={{width: '32px', height: '32px', fontSize: '0.8rem'}}>{req.usuarios.nombre_completo.charAt(0)}</div>
                                            <div className="user-info">
                                                <span className="name">{req.usuarios.nombre_completo}</span>
                                            </div>
                                        </div>
                                        <div className="record-details-premium mb-3">
                                            <span className="prod-name">{req.registros.producto_nombre}</span>
                                            <span className="lote-tag">LOTE: <b>{req.registros.lote_interno}</b></span>
                                        </div>
                                        <div className="reason-container-premium mb-3">
                                            <p className="reason-text">{req.motivo ? `"${req.motivo}"` : 'Sin justificación'}</p>
                                        </div>
                                    </div>
                                    <div className="m-card-footer">
                                        {req.status === 'pendiente' ? (
                                            <div className="action-button-group" style={{justifyContent: 'flex-start', width: '100%'}}>
                                                <button className="btn-confirm-premium aprobar" style={{flex: 1, padding: '10px'}} onClick={() => openConfirmModal(req, 'aprobar')}>Aprobar</button>
                                                <button className="btn-confirm-premium rechazazar" style={{flex: 1, padding: '10px', backgroundColor: '#dc2626'}} onClick={() => openConfirmModal(req, 'rechazar')}>Rechazar</button>
                                            </div>
                                        ) : (
                                            <div className={`status-final-premium ${req.status}`}>
                                                {req.status === 'aprobado' || req.status === 'usado' ? <i className="bi bi-check-circle-fill"></i> : <i className="bi bi-x-circle-fill"></i>}
                                                {req.status.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* MODALES PREMIUM */}
            {confirmModal.show && (
                <div className="modal-overlay-premium">
                    <div className="modal-backdrop-premium" onClick={() => setConfirmModal({ ...confirmModal, show: false })}></div>
                    <div className={`modal-box-premium ${confirmModal.type}`}>
                        <div className="modal-icon-circle-premium">
                            {confirmModal.type === 'aprobar' ? <i className="bi bi-check2-circle"></i> : <i className="bi bi-exclamation-triangle"></i>}
                        </div>
                        <h3 className="modal-title-premium">
                            {confirmModal.type === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
                        </h3>
                        <p className="modal-desc-premium">
                            {confirmModal.type === 'aprobar' 
                                ? 'Se habilitará permanentemente el permiso de edición única para este registro.' 
                                : 'Esta acción notificará al usuario y mantendrá el registro en su estado actual.'}
                        </p>
                        <div className="modal-details-card-premium">
                            <div className="detail-row"><span className="label">PERSONAL:</span><span className="val">{confirmModal.userName}</span></div>
                            <div className="detail-row"><span className="label">PRODUCTO:</span><span className="val">{confirmModal.productName}</span></div>
                        </div>
                        <div className="modal-actions-premium">
                            <button className="btn-confirm-premium aprobar" style={{backgroundColor: confirmModal.type === 'aprobar' ? '#16a34a' : '#dc2626'}} onClick={executeAction}>
                                {confirmModal.type === 'aprobar' ? 'Sí, Aprobar edición' : 'Sí, Rechazar solicitud'}
                            </button>
                            <button className="btn-cancel-premium" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>Mantener pendiente</button>
                        </div>
                    </div>
                </div>
            )}

            {/* REALTIME TOAST NOTIFICATION PREMIUM */}
            {realtimeNotification?.show && (
                <div className="toast-notification-premium" onClick={() => setRealtimeNotification(null)}>
                    <div className="toast-icon-pulse">
                        <i className="bi bi-bell"></i>
                    </div>
                    <div className="toast-body">
                        <span className="toast-label">NOTIFICACIÓN REAL-TIME</span>
                        <span className="toast-msg">{realtimeNotification.message}</span>
                    </div>
                    <button className="toast-close-btn" style={{background: 'none', border: 'none', fontSize: '1.2rem', marginLeft: 'auto'}}>&times;</button>
                </div>
            )}

            <style jsx>{`
                /* Modern SaaS Premium UI Design System */
                .admin-page-wrapper {
                    min-height: 100vh;
                    background-color: #f8fafc;
                    padding: 2rem;
                    padding-top: calc(60px + 2rem); /* Header móvil + padding original */
                    padding-left: 2rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                }

                @media (min-width: 992px) {
                    .admin-page-wrapper {
                        padding-top: 2rem;
                    }
                }

                .main-content {
                    max-width: 1300px;
                    margin: 0 auto;
                    position: relative;
                }

                .animate-in {
                    animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Ambient Background */
                .ambient-background {
                    position: fixed;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                    z-index: 0;
                }

                .ambient-sphere-1 {
                    position: absolute;
                    top: -10%;
                    right: -5%;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, rgba(14, 165, 233, 0) 70%);
                    border-radius: 50%;
                    filter: blur(60px);
                }

                .ambient-sphere-2 {
                    position: absolute;
                    bottom: -10%;
                    left: -5%;
                    width: 500px;
                    height: 500px;
                    background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0) 70%);
                    border-radius: 50%;
                    filter: blur(60px);
                }

                /* Header Premium */
                .header-premium-stack { margin-bottom: 2.5rem; position: relative; z-index: 10; }


                .header-container-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    gap: 2rem;
                }

                .badge-system-premium {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background: white;
                    padding: 8px 18px;
                    border-radius: 50px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    border: 1px solid #f1f5f9;
                    margin-bottom: 1.2rem;
                }

                .dot-pulse { width: 10px; height: 10px; background: #0ea5e9; border-radius: 50%; position: relative; }
                .dot-pulse::after {
                    content: ''; position: absolute; inset: 0; border-radius: 50%;
                    background: #0ea5e9; animation: dot-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                @keyframes dot-ping { 75%, 100% { transform: scale(3); opacity: 0; } }

                .badge-text { font-size: 0.75rem; font-weight: 900; letter-spacing: 0.05em; color: #475569; text-transform: uppercase; }

                .title-premium { font-size: 2.8rem; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; margin: 0; line-height: 1; }
                .subtitle-premium { color: #64748b; font-size: 1.1rem; margin-top: 1rem; max-width: 650px; font-weight: 500; line-height: 1.5; }

                .header-stats-premium { display: flex; gap: 16px; }
                .stat-pill-premium {
                    background: white; padding: 14px 24px; border-radius: 22px;
                    display: flex; align-items: center; gap: 16px; min-width: 180px;
                    border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    transition: all 0.3s;
                }
                .stat-pill-premium:hover { transform: translateY(-4px); box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.08); }

                .stat-icon-bg {
                    width: 48px; height: 48px; background: #f1f5f9; border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    color: #64748b; font-size: 1.4rem;
                }

                .stat-pill-premium.pending {
                    border-color: #fef3c7;
                    background: linear-gradient(to bottom right, #ffffff, #fffbeb);
                }
                .stat-pill-premium.pending .stat-icon-bg { background: #fef3c7; color: #d97706; }
                .stat-pill-premium.pending .val { color: #b45309; }

                .stat-content { display: flex; flex-direction: column; }
                .stat-content .val { font-size: 1.5rem; font-weight: 900; color: #0f172a; line-height: 1; }
                .stat-content .lab { font-size: 0.7rem; font-weight: 800; color: #94a3b8; margin-top: 6px; letter-spacing: 0.05em; text-transform: uppercase; }

                /* Content Card */
                .content-card-premium {
                    background: white; border-radius: 32px; border: 1px solid #f1f5f9;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
                    overflow: hidden; position: relative; z-index: 10; margin-bottom: 2rem;
                }

                /* Tabs Original Restyled */
                .tabs-container-premium {
                    display: flex; background: #f8fafc; padding: 10px 14px; gap: 10px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .tab-btn-premium {
                    display: flex; align-items: center; gap: 12px; padding: 14px 28px;
                    border-radius: 18px; border: none; background: transparent;
                    color: #64748b; font-weight: 700; font-size: 0.95rem;
                    transition: all 0.3s; cursor: pointer;
                }

                .tab-btn-premium:hover { color: #1e293b; background: rgba(255, 255, 255, 0.8); }
                .tab-btn-premium.active {
                    color: #0ea5e9; background: white;
                    box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.05);
                }

                .count-pill {
                    background: #ef4444; color: white; font-size: 0.75rem;
                    font-weight: 900; padding: 3px 9px; border-radius: 50px;
                }

                /* Toolbar */
                .toolbar-premium {
                    padding: 24px; display: flex; justify-content: space-between;
                    align-items: center; gap: 24px; background: white;
                }

                .search-box-premium {
                    flex: 1; background: #f1f5f9; border-radius: 20px;
                    padding: 0 24px; display: flex; align-items: center; gap: 16px;
                    height: 56px; border: 2px solid transparent; transition: all 0.3s;
                }
                .search-box-premium:focus-within {
                    background: white; border-color: #0ea5e9;
                    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1);
                }
                .search-box-premium input {
                    flex: 1; background: transparent; border: none; outline: none;
                    font-size: 1rem; color: #1e293b; font-weight: 600;
                }

                .filter-group-premium { display: flex; gap: 16px; }
                .select-wrapper-premium, .date-wrapper-premium {
                    background: #f1f5f9; border-radius: 18px; padding: 0 20px;
                    display: flex; align-items: center; gap: 12px; height: 56px;
                    border: 2px solid transparent; transition: all 0.3s; cursor: pointer; position: relative;
                }
                .select-wrapper-premium select {
                    background: transparent; border: none; outline: none;
                    font-size: 0.95rem; font-weight: 700; color: #475569; cursor: pointer;
                }
                .date-wrapper-premium input {
                    background: transparent; border: none; outline: none;
                    font-size: 0.95rem; font-weight: 700; color: #475569; cursor: pointer; width: 100px;
                }
                .hidden-date-input { position: absolute; opacity: 0; width: 0; pointer-events: none; }
                .clear-date-btn { background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; }

                /* Table Design */
                .table-responsive-premium { 
                    border-top: 1px solid #f1f5f9; 
                    overflow-x: auto;
                    width: 100%;
                    background: white;
                }
                .table-premium { 
                    width: 100%; 
                    min-width: 1150px; /* Evita que las columnas se compriman */
                    border-collapse: collapse; 
                }
                .table-premium th {
                    background: #f8fafc; padding: 18px 24px; font-size: 0.75rem;
                    font-weight: 800; color: #94a3b8; text-transform: uppercase;
                    letter-spacing: 0.1em; text-align: left;
                }
                .row-premium { border-bottom: 1px solid #f1f5f9; transition: all 0.2s; }
                .row-premium:hover { background: #f8fafc; }
                .row-highlight { background: rgba(254, 252, 232, 0.5); }
                .table-premium td { padding: 20px 24px; vertical-align: middle; }

                /* ID and User Styles */
                .id-badge-premium { display: flex; flex-direction: column; }
                .id-main { font-size: 1rem; font-weight: 950; color: #0284c7; }
                .id-sub { font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin-top: 2px; }

                .user-profile-premium { display: flex; align-items: center; gap: 14px; }
                .avatar-premium {
                    width: 42px; height: 42px; background: linear-gradient(135deg, #0ea5e9, #6366f1);
                    color: white; border-radius: 14px; display: flex; align-items: center;
                    justify-content: center; font-weight: 900; font-size: 1rem;
                }
                .user-info .name { font-size: 0.95rem; font-weight: 800; color: #1e293b; display: block; }
                .user-info .handle { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }

                .record-details-premium { display: flex; flex-direction: column; }
                .prod-name { font-size: 0.95rem; font-weight: 800; color: #334155; }
                .lote-tag { font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-top: 4px; }
                .reason-text { font-size: 0.85rem; color: #64748b; font-style: italic; margin: 0; }

                /* Action Buttons */
                .action-button-group { display: flex; gap: 10px; }
                .btn-action-premium {
                    width: 44px; height: 44px; border-radius: 14px; border: none;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.3rem; cursor: pointer; transition: all 0.2s;
                }
                .btn-action-premium.approve { background: #f0fdf4; color: #16a34a; }
                .btn-action-premium.approve:hover { background: #16a34a; color: white; transform: scale(1.1); }
                .btn-action-premium.reject { background: #fef2f2; color: #dc2626; }
                .btn-action-premium.reject:hover { background: #dc2626; color: white; transform: scale(1.1); }

                /* Status Indicators */
                .status-final-premium {
                    display: inline-flex; align-items: center; gap: 8px;
                    padding: 8px 16px; border-radius: 50px; font-size: 0.8rem; font-weight: 900;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .status-final-premium.aprobado { background: #f0fdf4; color: #16a34a; }
                .status-final-premium.rechazado { background: #fef2f2; color: #dc2626; }
                .status-final-premium.usado { background: #eff6ff; color: #1d4ed8; }

                /* Mobile View */
                .mobile-view-premium { display: none; padding: 16px; }
                .mobile-card-premium {
                    background: white; border: 1px solid #f1f5f9; border-radius: 24px;
                    padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
                }

                @media (max-width: 768px) {
                    .desktop-view-premium { display: none; }
                    .mobile-view-premium { display: block; }
                    .header-container-premium { flex-direction: column; align-items: flex-start; }
                    .header-stats-premium { width: 100%; margin-top: 1.5rem; }
                    .stat-pill-premium { flex: 1; padding: 10px 16px; }
                    .title-premium { font-size: 2rem; }
                    .toolbar-premium { flex-direction: column; align-items: stretch; }
                }

                /* Modals Premium */
                .modal-overlay-premium {
                    position: fixed; inset: 0; z-index: 1000; display: flex;
                    align-items: center; justify-content: center; padding: 2rem;
                }
                .modal-backdrop-premium {
                    position: absolute; inset: 0; background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(12px);
                }
                .modal-box-premium {
                    position: relative; background: white; width: 100%; max-width: 480px;
                    border-radius: 36px; padding: 40px; text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                .modal-icon-circle-premium {
                    width: 70px; height: 70px; border-radius: 50%; margin: 0 auto 20px;
                    display: flex; align-items: center; justify-content: center; font-size: 2.2rem;
                }
                .modal-box-premium.aprobar .modal-icon-circle-premium { background: #f0fdf4; color: #16a34a; }
                .modal-box-premium.rechazar .modal-icon-circle-premium { background: #fef2f2; color: #dc2626; }
                
                .btn-confirm-premium {
                    padding: 14px 28px; border-radius: 16px; border: none; color: white;
                    font-weight: 800; cursor: pointer; transition: all 0.2s;
                }
                .btn-cancel-premium {
                    padding: 14px 28px; border-radius: 16px; border: none; background: #f1f5f9;
                    color: #64748b; font-weight: 700; cursor: pointer; margin-top: 10px;
                }

                .modal-details-card-premium {
                    background: #f8fafc; padding: 16px; border-radius: 18px; text-align: left;
                    margin-bottom: 24px;
                }
                .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                .detail-row .label { font-size: 0.7rem; color: #94a3b8; font-weight: 800; }
                .detail-row .val { font-size: 0.85rem; color: #1e293b; font-weight: 800; }

                /* Realtime Toast */
                .toast-notification-premium {
                    position: fixed; bottom: 2rem; right: 2rem; z-index: 2000;
                    background: white; padding: 20px 28px; border-radius: 28px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                    display: flex; align-items: center; gap: 20px;
                    border: 1px solid #f1f5f9; animation: slideIn 0.5s ease-out;
                }
                .toast-icon-pulse {
                    width: 44px; height: 44px; background: #eff6ff; color: #2563eb;
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 1.3rem;
                }
                @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                /* Origin Pills */
                .origin-pill-premium {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 900;
                }
                .origin-pill-premium.escaneo { background: #e0f2fe; color: #0369a1; }
                .origin-pill-premium.calidad { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

                /* Spinner Micro */
                .spinner-micro {
                    width: 18px; height: 18px; border: 2px solid rgba(0,0,0,0.1);
                    border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>
    );
}

