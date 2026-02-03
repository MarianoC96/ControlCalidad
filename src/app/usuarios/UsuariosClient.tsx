'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import type { Usuario } from '@/lib/supabase/types';

export default function UsuariosClient() {
    const router = useRouter();
    const supabase = createClient();

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');

    // States for Search/Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<Usuario | null>(null);
    const [formData, setFormData] = useState({
        nombre_completo: '',
        usuario: '',
        email: '',
        password: '',
        roles: 'trabajador' as 'administrador' | 'trabajador',
        activo: true,
    });

    // Custom Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        action: () => void;
        type: 'danger' | 'warning' | 'info';
    }>({ show: false, title: '', message: '', action: () => { }, type: 'info' });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        checkAuth();
        loadUsuarios();
    }, []);

    const checkAuth = async () => {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            router.push('/');
            return;
        }
        const user = await response.json();
        setUserName(user.nombre_completo);
        setUserRole(user.roles);
        if (user.roles !== 'administrador') router.push('/registro-productos');
    };

    const loadUsuarios = async () => {
        try {
            const response = await fetch('/api/usuarios');
            if (!response.ok) {
                if (response.status === 403) {
                    setError(`Acceso denegado.`);
                    return;
                }
                throw new Error('Error al cargar');
            }
            const data = await response.json();
            if (Array.isArray(data)) {
                setUsuarios(data);
                setError('');
            }
        } catch (err) {
            setError('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.nombre_completo.trim() || !formData.usuario.trim()) {
            setError('Nombre y usuario son obligatorios');
            return;
        }
        setSaving(true);
        try {
            const response = await fetch('/api/usuarios', {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingUser?.id, ...formData }),
            });
            if (response.ok) {
                setShowModal(false);
                loadUsuarios();
            } else {
                const data = await response.json();
                setError(data.error || 'Error al guardar');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const executeDelete = async (id: number) => {
        try {
            const user = usuarios.find(u => u.id === id);
            if (!user) return;
            await fetch('/api/usuarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...user, is_deleted: true }),
            });
            loadUsuarios();
            setConfirmModal({ ...confirmModal, show: false });
        } catch (err) {
            alert('Error al deshabilitar');
        }
    };

    const executeReset2FA = async (id: number) => {
        try {
            const user = usuarios.find(u => u.id === id);
            if (!user) return;
            await fetch('/api/usuarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...user, two_factor_secret: null }),
            });
            loadUsuarios();
            setConfirmModal({ ...confirmModal, show: false });
        } catch (err) {
            alert('Error al resetear');
        }
    };

    const openDisableConfirm = (user: Usuario) => {
        setConfirmModal({
            show: true,
            title: '¿Eliminar Personal?',
            message: `Esta acción eliminará a ${user.nombre_completo} del sistema de forma permanente. ¿Deseas continuar?`,
            type: 'danger',
            action: () => executeDelete(user.id)
        });
    };

    const openReset2FAConfirm = (user: Usuario) => {
        setConfirmModal({
            show: true,
            title: '¿Resetear Seguridad 2FA?',
            message: `Se eliminará la llave de seguridad de ${user.nombre_completo}. Deberá volver a configurarla en su próximo login.`,
            type: 'warning',
            action: () => executeReset2FA(user.id)
        });
    };

    const filteredUsuarios = usuarios.filter(user => {
        const matchesSearch =
            user.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.usuario.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.roles === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (loading) return <div className="loader-screen">Sincronizando Sistema...</div>;

    return (
        <div className="admin-page-wrapper">
            <Navbar userName={userName} userRole={userRole} onLogout={() => router.push('/')} />

            <main className="main-content">
                {/* Header Section */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system"><span className="dot-pulse"></span>CONTROL DE ACCESO</div>
                        <h1 className="title">Personal del Sistema</h1>
                        <p className="subtitle">Gestione perfiles, roles y estados de cuenta desde un solo lugar.</p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-pill">
                            <span className="val">{usuarios.length}</span>
                            <span className="lab">TOTAL</span>
                        </div>
                        <button className="btn-add-premium shadow-sm" onClick={() => { setEditingUser(null); setFormData({ nombre_completo: '', usuario: '', email: '', password: '', roles: 'trabajador', activo: true }); setShowModal(true); }}>
                            <i className="bi bi-person-plus-fill me-2"></i>
                            <span>Nuevo Personal</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="filters-bar shadow-sm border">
                    <div className="search-group"><i className="bi bi-search"></i><input type="text" placeholder="Buscar personal..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="all">Todos los roles</option>
                        <option value="trabajador">Trabajadores</option>
                        <option value="administrador">Administradores</option>
                    </select>
                </div>

                {/* Feed */}
                <div className="users-feed">
                    {filteredUsuarios.map((user) => (
                        <div key={user.id} className={`user-card border shadow-sm ${!user.activo ? 'card-inactive' : ''}`}>
                            <div className="card-top">
                                <div className="user-profile">
                                    <div className={`avatar ${user.roles === 'administrador' ? 'av-admin' : ''}`}>{user.nombre_completo.charAt(0)}</div>
                                    <div className="u-meta">
                                        <div className="u-name">
                                            {user.nombre_completo}
                                        </div>
                                        <div className="u-handle">
                                            <span>@{user.usuario}</span>
                                            {user.email && <span className="u-email">• {user.email}</span>}
                                        </div>
                                        {user.two_factor_secret && (
                                            <div className="status-2fa-badge mt-1">
                                                <i className="bi bi-shield-fill-check"></i> PROTECCIÓN 2FA ACTIVA
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="user-tags">
                                    <span className={`chip chip-role ${user.roles}`}>{user.roles}</span>
                                    <span className={`chip chip-status ${user.activo ? 'active' : 'inactive'}`}>{user.activo ? 'Activo' : 'Inactivo'}</span>
                                </div>
                            </div>
                            <div className="card-actions">
                                {user.usuario !== 'sadmin' ? (
                                    <>
                                        <button className="btn-c" onClick={() => {
                                            setEditingUser(user);
                                            setFormData({
                                                nombre_completo: user.nombre_completo,
                                                usuario: user.usuario,
                                                email: user.email || '',
                                                password: '',
                                                roles: user.roles,
                                                activo: user.activo
                                            });
                                            setError('');
                                            setShowModal(true);
                                        }} title="Editar Perfil"><i className="bi bi-pencil-fill"></i> Editar</button>

                                        {user.two_factor_secret && (
                                            <button className="btn-c btn-warn" onClick={() => openReset2FAConfirm(user)}><i className="bi bi-shield-slash"></i> 2FA</button>
                                        )}

                                        <button className="btn-c btn-danger-solid" onClick={() => openDisableConfirm(user)} title="Eliminar Usuario">
                                            <i className="bi bi-trash3-fill me-1"></i> Eliminar
                                        </button>
                                    </>
                                ) : (
                                    <div className="system-tag"><i className="bi bi-lock-fill"></i> PROTEGIDO POR SISTEMA</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* MODAL DE EDICIÓN - ÚNICO PARA TODO */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content shadow-lg border-0" onClick={e => e.stopPropagation()}>
                        <div className="modal-top">
                            <h5>{editingUser ? 'Actualizar Usuario' : 'Nuevo Registro'}</h5>
                            <button className="close-m" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="form-item mb-3">
                                <label>NOMBRE COMPLETO</label>
                                <input type="text" value={formData.nombre_completo} onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })} placeholder="Ej. Juan Pérez" />
                            </div>
                            <div className="row g-3 mb-3">
                                <div className="col-md-6">
                                    <div className="form-item">
                                        <label>USUARIO (@)</label>
                                        <input type="text" value={formData.usuario} onChange={(e) => setFormData({ ...formData, usuario: e.target.value })} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="form-item">
                                        <label>ROL DE ACCESO</label>
                                        <select value={formData.roles} onChange={(e) => setFormData({ ...formData, roles: e.target.value as any })}>
                                            <option value="trabajador">Trabajador</option>
                                            <option value="administrador">Administrador</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="form-item mb-3">
                                <label>EMAIL INSTITUCIONAL</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="form-item mb-4">
                                <label>CONTRASEÑA {editingUser ? '(Opcional)' : ''}</label>
                                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                            </div>

                            {/* ESTADO DE CUENTA - INTERRUPTOR */}
                            <div className="toggle-box border rounded-4 p-3 d-flex justify-content-between align-items-center">
                                <div className="toggle-info">
                                    <div className="fw-bold small">Estado de Cuenta</div>
                                    <div className={`small ${formData.activo ? 'text-success' : 'text-danger'}`}>{formData.activo ? 'Activa y Habilitada' : 'Inactiva / Bloqueada'}</div>
                                </div>
                                <div className="form-check form-switch m-0">
                                    <input className="form-check-input" type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} style={{ width: '3rem', height: '1.5rem', cursor: 'pointer' }} />
                                </div>
                            </div>

                            {error && <div className="error-msg mt-3"><i className="bi bi-info-circle-fill"></i> {error}</div>}
                        </div>
                        <div className="modal-footer p-4 pt-0 border-0">
                            <button className="btn-cancel" onClick={() => setShowModal(false)}>Atrás</button>
                            <button className="btn-confirm" onClick={handleSave} disabled={saving}>{saving ? 'Procesando...' : 'Guardar Cambios'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN CUSTOM (Sustituye a Confirm del navegador) */}
            {confirmModal.show && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="confirm-box shadow-xl border-0 p-4 text-center">
                        <div className={`icon-circle mb-3 mx-auto i-${confirmModal.type}`}>
                            <i className={`bi ${confirmModal.type === 'danger' ? 'bi-trash3' : 'bi-exclamation-triangle'}`}></i>
                        </div>
                        <h5 className="fw-black mb-2">{confirmModal.title}</h5>
                        <p className="text-muted small mb-4">{confirmModal.message}</p>
                        <div className="d-flex gap-2 justify-content-center">
                            <button className="btn-cancel" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>No, Cancelar</button>
                            <button className={`btn-confirm bg-${confirmModal.type === 'danger' ? 'danger' : 'warning'}`} onClick={confirmModal.action}>Sí, Continuar</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .admin-page-wrapper { min-height: 100vh; background-color: #f0f2f5; font-family: 'Inter', system-ui, sans-serif; }
                .main-content { max-width: 900px; margin: 0 auto; padding: 40px 20px; }

                /* Header */
                .header-container { background: white; border-radius: 24px; padding: 25px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .badge-system { display: inline-flex; align-items: center; gap: 8px; color: #0369a1; font-weight: 800; font-size: 0.7rem; margin-bottom: 10px; }
                .dot-pulse { width: 8px; height: 8px; background: #0369a1; border-radius: 50%; animation: p 2s infinite; }
                @keyframes p { 0% { box-shadow: 0 0 0 0 rgba(3,105,161,0.4); } 70% { box-shadow: 0 0 0 6px rgba(3,105,161,0); } 100% { box-shadow: 0 0 0 0 rgba(3,105,161,0); } }
                .title { font-size: 1.6rem; font-weight: 900; color: #1e293b; margin: 0; }
                .subtitle { color: #64748b; font-size: 0.9rem; }
                
                .header-stats { display: flex; gap: 15px; align-items: center; }
                .stat-pill { background: #f8fafc; padding: 8px 15px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; text-align: center; }
                .stat-pill .val { font-weight: 900; font-size: 1.2rem; line-height: 1; }
                .stat-pill .lab { font-size: 0.6rem; font-weight: 800; color: #94a3b8; }
                .btn-add-premium { 
                    background: #10b981; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 14px; 
                    font-weight: 800; 
                    font-size: 0.85rem; 
                    display: flex; 
                    align-items: center; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .btn-add-premium:hover { 
                    transform: translateY(-2px); 
                    background: #059669; 
                    box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
                }
                .btn-add-premium i { font-size: 1.1rem; }

                /* Filters */
                .filters-bar { background: white; border-radius: 50px; padding: 8px 15px; display: flex; gap: 15px; margin-bottom: 24px; }
                .search-group { flex: 1; display: flex; align-items: center; gap: 10px; padding-left: 10px; }
                .search-group i { color: #94a3b8; }
                .search-group input { border: none; outline: none; width: 100%; font-size: 0.9rem; }
                .filter-select { border: 1px solid #e2e8f0; border-radius: 50px; padding: 5px 15px; font-size: 0.85rem; outline: none; }

                /* Cards */
                .user-card { background: white; border-radius: 20px; padding: 20px; margin-bottom: 12px; transition: 0.2s; }
                .user-card:hover { transform: translateY(-3px); }
                .card-inactive { opacity: 0.7; border-left: 5px solid #94a3b8 !important; }
                .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
                .user-profile { display: flex; gap: 15px; align-items: center; }
                .avatar { width: 44px; height: 44px; background: #3b82f6; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; }
                .av-admin { background: #6366f1; }
                .u-name { font-weight: 800; color: #1e293b; font-size: 0.95rem; line-height: 1.2; }
                .u-handle span { color: #3b82f6; font-weight: 700; font-size: 0.8rem; }
                .u-email { color: #94a3b8; font-size: 0.8rem; }
                
                .status-2fa-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    color: #10b981;
                    font-size: 0.65rem;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    background: #ecfdf5;
                    padding: 2px 8px;
                    border-radius: 6px;
                }
                
                .user-tags { display: flex; gap: 6px; }
                .chip { padding: 4px 10px; border-radius: 50px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(0,0,0,0.05); }
                .chip-role.administrador { background: #e0e7ff; color: #4338ca; }
                .chip-role.trabajador { background: #f1f5f9; color: #475569; }
                .chip-status.active { background: #d1fae5; color: #065f46; }
                .chip-status.inactive { background: #f1f5f9; color: #94a3b8; }

                .card-actions { border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; gap: 8px; align-items: center; }
                .btn-c { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 15px; font-size: 0.8rem; font-weight: 700; transition: 0.2s; }
                .btn-c:hover { background: #f1f5f9; border-color: #cbd5e1; }
                .btn-warn { color: #d97706; }
                .btn-danger-solid { 
                    background: #ef4444; 
                    color: white; 
                    border: 1px solid #dc2626; 
                }
                .btn-danger-solid:hover { 
                    background: #b91c1c; 
                    border-color: #991b1b; 
                    box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);
                }
                .system-tag { font-size: 0.6rem; font-weight: 900; color: #cbd5e1; letter-spacing: 1px; }

                /* Modals */
                .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content { background: white; border-radius: 24px; width: 100%; max-width: 500px; overflow: hidden; }
                .modal-top { padding: 20px 24px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
                .modal-top h5 { margin: 0; font-weight: 900; font-size: 1.1rem; }
                .close-m { background: none; border: none; font-size: 1.5rem; color: #94a3b8; }
                
                .form-item label { display: block; font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin-bottom: 5px; text-transform: uppercase; }
                .form-item input, .form-item select { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; outline: none; font-size: 0.9rem; }
                .form-item input:focus { border-color: #3b82f6; }
                
                .btn-cancel { background: #f1f5f9; border: none; padding: 10px 25px; border-radius: 50px; font-weight: 700; color: #64748b; }
                .btn-confirm { background: #1e293b; border: none; color: white; padding: 10px 25px; border-radius: 50px; font-weight: 700; }

                /* Confirm Box */
                .confirm-box { background: white; border-radius: 24px; width: 350px; }
                .icon-circle { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
                .i-danger { background: #fee2e2; color: #ef4444; }
                .i-warning { background: #fef3c7; color: #d97706; }
                .error-msg { background: #fee2e2; color: #b91c1c; padding: 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; }

                .loader-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; font-weight: 900; color: #0369a1; letter-spacing: 2px; }
            `}</style>
        </div>
    );
}
