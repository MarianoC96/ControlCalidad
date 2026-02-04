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

            {/* MODAL DE EDICIÓN - DISEÑO PREMIUM */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content shadow-lg border-0" onClick={e => e.stopPropagation()}>
                        {/* Header con Avatar Dinámico */}
                        <div className="modal-header-premium">
                            <div className="modal-header-bg"></div>
                            <div className="modal-avatar-section">
                                <div className={`modal-avatar ${formData.roles === 'administrador' ? 'avatar-admin' : 'avatar-worker'}`}>
                                    {formData.nombre_completo ? formData.nombre_completo.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="modal-user-preview">
                                    <span className="preview-name">{formData.nombre_completo || 'Nuevo Usuario'}</span>
                                    <span className="preview-handle">@{formData.usuario || 'usuario'}</span>
                                </div>
                            </div>
                            <button className="close-modal-btn" onClick={() => setShowModal(false)}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div className="modal-body-premium">
                            {/* Título dinámico */}
                            <div className="modal-section-title">
                                <i className={`bi ${editingUser ? 'bi-pencil-square' : 'bi-person-plus-fill'}`}></i>
                                <span>{editingUser ? 'Editar Información' : 'Registrar Personal'}</span>
                            </div>

                            {/* Nombre Completo */}
                            <div className="premium-input-group">
                                <div className="input-icon"><i className="bi bi-person-fill"></i></div>
                                <div className="input-content">
                                    <label>Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={formData.nombre_completo}
                                        onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                                        placeholder="Ingresa el nombre completo"
                                    />
                                </div>
                            </div>

                            {/* Usuario y Rol en Grid */}
                            <div className="input-grid">
                                <div className="premium-input-group">
                                    <div className="input-icon"><i className="bi bi-at"></i></div>
                                    <div className="input-content">
                                        <label>Usuario</label>
                                        <input
                                            type="text"
                                            value={formData.usuario}
                                            onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                                            placeholder="nombre_usuario"
                                        />
                                    </div>
                                </div>

                                <div className="premium-input-group">
                                    <div className="input-icon"><i className="bi bi-shield-fill"></i></div>
                                    <div className="input-content">
                                        <label>Rol de Acceso</label>
                                        <select value={formData.roles} onChange={(e) => setFormData({ ...formData, roles: e.target.value as 'administrador' | 'trabajador' })}>
                                            <option value="trabajador">👷 Trabajador</option>
                                            <option value="administrador">👑 Administrador</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="premium-input-group">
                                <div className="input-icon"><i className="bi bi-envelope-fill"></i></div>
                                <div className="input-content">
                                    <label>Email Institucional</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="correo@empresa.com"
                                    />
                                </div>
                            </div>

                            {/* Contraseña */}
                            <div className="premium-input-group">
                                <div className="input-icon"><i className="bi bi-key-fill"></i></div>
                                <div className="input-content">
                                    <label>Contraseña {editingUser && <span className="optional-tag">Opcional</span>}</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser ? "Dejar vacío para mantener" : "Contraseña segura"}
                                    />
                                </div>
                            </div>

                            {/* ESTADO DE CUENTA - DISEÑO PREMIUM CON ANIMACIONES */}
                            <div className={`status-card ${formData.activo ? 'status-active' : 'status-inactive'}`}>
                                <div className="status-visual">
                                    <div className="status-icon-container">
                                        <div className="status-icon-bg"></div>
                                        <i className={`bi ${formData.activo ? 'bi-shield-check' : 'bi-shield-x'}`}></i>
                                        {formData.activo && <div className="status-pulse"></div>}
                                    </div>
                                </div>
                                <div className="status-info">
                                    <div className="status-title">Estado de Cuenta</div>
                                    <div className="status-description">
                                        {formData.activo ? (
                                            <>
                                                <span className="status-badge active">
                                                    <i className="bi bi-check-circle-fill"></i> ACTIVA
                                                </span>
                                                <p>El usuario puede acceder al sistema normalmente</p>
                                            </>
                                        ) : (
                                            <>
                                                <span className="status-badge inactive">
                                                    <i className="bi bi-x-circle-fill"></i> BLOQUEADA
                                                </span>
                                                <p>El acceso al sistema está restringido</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="status-toggle">
                                    <button
                                        type="button"
                                        className={`toggle-btn ${formData.activo ? 'toggle-on' : 'toggle-off'}`}
                                        onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                                    >
                                        <span className="toggle-track">
                                            <span className="toggle-thumb">
                                                <i className={`bi ${formData.activo ? 'bi-check' : 'bi-x'}`}></i>
                                            </span>
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="error-banner">
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer con botones premium */}
                        <div className="modal-footer-premium">
                            <button className="btn-modal-cancel" onClick={() => setShowModal(false)}>
                                <i className="bi bi-arrow-left"></i>
                                <span>Cancelar</span>
                            </button>
                            <button className="btn-modal-save" onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>
                                        <div className="spinner-save"></div>
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check2-circle"></i>
                                        <span>Guardar Cambios</span>
                                    </>
                                )}
                            </button>
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

                /* Modals - Premium Design */
                .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .modal-content { background: white; border-radius: 24px; width: 100%; max-width: 520px; overflow: hidden; animation: slideUp 0.3s ease-out; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

                /* Modal Header Premium */
                .modal-header-premium { position: relative; padding: 30px 24px 20px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); overflow: hidden; }
                .modal-header-bg { position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
                .modal-avatar-section { position: relative; display: flex; align-items: center; gap: 16px; }
                .modal-avatar { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.3s ease; }
                .avatar-worker { background: linear-gradient(135deg, #3b82f6, #2563eb); }
                .avatar-admin { background: linear-gradient(135deg, #8b5cf6, #6366f1); }
                .modal-user-preview { display: flex; flex-direction: column; gap: 2px; }
                .preview-name { color: white; font-weight: 800; font-size: 1.1rem; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                .preview-handle { color: rgba(255,255,255,0.7); font-size: 0.85rem; font-weight: 600; }
                .close-modal-btn { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 12px; background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .close-modal-btn:hover { background: rgba(255,255,255,0.2); color: white; transform: rotate(90deg); }

                /* Modal Body Premium */
                .modal-body-premium { padding: 24px; }
                .modal-section-title { display: flex; align-items: center; gap: 10px; color: #1e293b; font-weight: 800; font-size: 0.9rem; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
                .modal-section-title i { color: #3b82f6; font-size: 1.1rem; }

                /* Premium Input Groups */
                .premium-input-group { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding: 14px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; transition: all 0.2s ease; }
                .premium-input-group:focus-within { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
                .input-icon { width: 40px; height: 40px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.1rem; flex-shrink: 0; border: 1px solid #e2e8f0; }
                .premium-input-group:focus-within .input-icon { background: #3b82f6; color: white; border-color: #3b82f6; }
                .input-content { flex: 1; min-width: 0; }
                .input-content label { display: block; font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
                .optional-tag { background: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; margin-left: 6px; text-transform: uppercase; }
                .input-content input, .input-content select { width: 100%; padding: 8px 0; border: none; background: transparent; font-size: 0.95rem; color: #1e293b; outline: none; font-weight: 500; }
                .input-content input::placeholder { color: #94a3b8; }
                .input-content select { cursor: pointer; }

                /* Input Grid */
                .input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                @media (max-width: 500px) { .input-grid { grid-template-columns: 1fr; } }

                /* STATUS CARD - PREMIUM DESIGN WITH ANIMATIONS */
                .status-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 20px; margin-top: 8px; margin-bottom: 16px; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
                .status-card::before { content: ''; position: absolute; inset: 0; opacity: 0.05; background-image: radial-gradient(circle at 20% 50%, currentColor 1px, transparent 1px); background-size: 20px 20px; }
                .status-active { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; color: #10b981; }
                .status-inactive { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; color: #ef4444; }

                .status-visual { position: relative; }
                .status-icon-container { position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; }
                .status-icon-bg { position: absolute; inset: 0; border-radius: 16px; background: currentColor; opacity: 0.15; }
                .status-icon-container i { position: relative; z-index: 1; font-size: 1.6rem; }
                .status-pulse { position: absolute; inset: -4px; border-radius: 20px; border: 2px solid currentColor; opacity: 0; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.3); opacity: 0; } }

                .status-info { flex: 1; }
                .status-title { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; margin-bottom: 6px; color: #1e293b; }
                .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; }
                .status-badge.active { background: #10b981; color: white; }
                .status-badge.inactive { background: #ef4444; color: white; }
                .status-description p { margin: 6px 0 0; font-size: 0.8rem; color: #64748b; }

                /* Custom Toggle Button */
                .status-toggle { flex-shrink: 0; }
                .toggle-btn { background: none; border: none; cursor: pointer; padding: 0; outline: none; }
                .toggle-track { display: block; width: 56px; height: 32px; border-radius: 50px; position: relative; transition: all 0.3s ease; }
                .toggle-on .toggle-track { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
                .toggle-off .toggle-track { background: linear-gradient(135deg, #94a3b8, #64748b); box-shadow: 0 4px 12px rgba(100,116,139,0.3); }
                .toggle-thumb { position: absolute; top: 3px; width: 26px; height: 26px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
                .toggle-on .toggle-thumb { left: 27px; color: #10b981; }
                .toggle-off .toggle-thumb { left: 3px; color: #64748b; }
                .toggle-btn:hover .toggle-track { transform: scale(1.05); }
                .toggle-btn:active .toggle-thumb { width: 30px; }

                /* Error Banner */
                .error-banner { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: linear-gradient(135deg, #fef2f2, #fee2e2); border: 1px solid #fca5a5; border-radius: 14px; color: #b91c1c; font-size: 0.85rem; font-weight: 600; animation: shake 0.4s ease-in-out; }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
                .error-banner i { font-size: 1.1rem; }

                /* Modal Footer Premium */
                .modal-footer-premium { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; gap: 12px; }
                .btn-modal-cancel { display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: white; border: 2px solid #e2e8f0; border-radius: 14px; color: #64748b; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
                .btn-modal-cancel:hover { border-color: #cbd5e1; background: #f8fafc; color: #475569; }
                .btn-modal-save { display: flex; align-items: center; gap: 8px; padding: 12px 28px; background: linear-gradient(135deg, #1e293b, #334155); border: none; border-radius: 14px; color: white; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(30,41,59,0.3); }
                .btn-modal-save:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(30,41,59,0.4); }
                .btn-modal-save:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
                .spinner-save { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Confirm Box */
                .confirm-box { background: white; border-radius: 24px; width: 350px; }
                .icon-circle { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
                .i-danger { background: #fee2e2; color: #ef4444; }
                .i-warning { background: #fef3c7; color: #d97706; }
                .error-msg { background: #fee2e2; color: #b91c1c; padding: 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; }

                .btn-cancel { background: #f1f5f9; border: none; padding: 10px 25px; border-radius: 50px; font-weight: 700; color: #64748b; cursor: pointer; }
                .btn-confirm { background: #1e293b; border: none; color: white; padding: 10px 25px; border-radius: 50px; font-weight: 700; cursor: pointer; }

                .loader-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; font-weight: 900; color: #0369a1; letter-spacing: 2px; }
            `}</style>
        </div>
    );
}
