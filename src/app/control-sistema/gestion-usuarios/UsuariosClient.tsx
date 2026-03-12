'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import type { Usuario } from '@/lib/supabase/types';

interface Role {
    id: number;
    nombre: string;
    is_system: boolean;
}

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
    const [rolesList, setRolesList] = useState<Role[]>([]);
    const [formData, setFormData] = useState({
        nombre_completo: '',
        usuario: '',
        password: '',
        roles: 'trabajador' as 'administrador' | 'trabajador',
        role_id: null as number | null,
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
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        checkAuth();
        loadRoles();
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
        if (user.roles !== 'administrador') router.push('/control-calidad/registro-productos');
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

    const loadRoles = async () => {
        try {
            const response = await fetch('/api/roles');
            if (response.ok) {
                const data = await response.json();
                setRolesList(data.roles || []);
            }
        } catch (err) {
            console.error('Error cargando roles', err);
        }
    };

    const handleSave = async () => {
        if (!formData.nombre_completo.trim() || !formData.usuario.trim()) {
            setError('Nombre y usuario son obligatorios');
            return;
        }
        if (!formData.role_id) {
            setError('Debe seleccionar un rol de acceso');
            return;
        }
        if (!editingUser && !formData.password.trim()) {
            setError('La contraseña es obligatoria para nuevos usuarios');
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

    const openDisableConfirm = (user: Usuario) => {
        setConfirmModal({
            show: true,
            title: '¿Eliminar Personal?',
            message: `Esta acción eliminará a ${user.nombre_completo} del sistema de forma permanente. ¿Deseas continuar?`,
            type: 'danger',
            action: () => executeDelete(user.id)
        });
    };


    const filteredUsuarios = usuarios.filter(user => {
        const matchesSearch =
            user.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.usuario.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesRole = false;
        if (roleFilter === 'all') {
            matchesRole = true;
        } else {
            // Filtrar estrictamente por el id numérico del rol asignado
            matchesRole = user.role_id?.toString() === roleFilter;
        }

        return matchesSearch && matchesRole;
    });

    if (loading) return <LoadingOverlay message="Sincronizando Usuarios..." />;

    return (
        <div className="admin-page-wrapper">


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
                        <button className="btn-add-premium shadow-sm" onClick={() => {
                            setEditingUser(null);
                            setFormData({
                                nombre_completo: '',
                                usuario: '',
                                password: '',
                                roles: 'trabajador',
                                role_id: null,
                                activo: true,
                            });
                            setShowModal(true);
                        }}>
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
                        {rolesList.map(r => (
                            <option key={r.id} value={r.id.toString()}>{r.nombre}</option>
                        ))}
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
                                        </div>

                                    </div>
                                </div>
                                <div className="user-tags">
                                    <span className={`chip chip-role ${user.roles}`}>
                                        {rolesList.find(r => r.id === user.role_id)?.nombre || user.roles}
                                    </span>
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
                                                password: '',
                                                roles: user.roles,
                                                role_id: user.role_id,
                                                activo: user.activo,
                                            });
                                            setError('');
                                            setShowModal(true);
                                        }} title="Editar Perfil"><i className="bi bi-pencil-fill"></i> Editar</button>




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
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-xl max-h-[90vh]" style={{ zIndex: 10 }} onClick={e => e.stopPropagation()}>
                        
                        {/* Header Estilo Historial */}
                        <div className="p-5 sm:p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 ${formData.roles === 'administrador' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                                    <i className={`bi ${editingUser ? 'bi-pencil-square' : 'bi-person-plus-fill'}`}></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">
                                        {editingUser ? 'Editar Personal' : 'Registrar Personal'}
                                    </h3>
                                    <p className="text-[#64748b] text-sm mt-1 mb-0">
                                        {formData.nombre_completo || 'Nuevo Usuario'} (@{formData.usuario || 'usuario'})
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] flex items-center justify-center text-[#1e293b] transition-transform active:scale-90 border-0 shadow-sm">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        {/* Body Scrollable */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="space-y-6">
                                {/* Nombre Completo */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Nombre Completo</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.nombre_completo}
                                            onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-medium"
                                            placeholder="Ingresa el nombre completo"
                                        />
                                        <i className="bi bi-person absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                                    </div>
                                </div>

                                {/* Usuario y Rol en Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Nombre de Usuario</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.usuario}
                                                onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                                                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-mono"
                                                placeholder="usuario123"
                                            />
                                            <i className="bi bi-at absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Rol de Acceso</label>
                                        <div className="relative">
                                            <select
                                                value={formData.role_id || ''}
                                                onChange={(e) => {
                                                    const selectedRoleId = e.target.value ? parseInt(e.target.value) : null;
                                                    const selectedRole = rolesList.find(r => r.id === selectedRoleId);
                                                    const internalRoleTag = selectedRole?.nombre.toLowerCase().includes('admin') ? 'administrador' : 'trabajador';
                                                    setFormData({
                                                        ...formData,
                                                        role_id: selectedRoleId,
                                                        roles: internalRoleTag
                                                    });
                                                }}
                                                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all appearance-none"
                                            >
                                                <option value="" disabled>Seleccione un rol...</option>
                                                {rolesList.filter(r => !r.is_system).map(r => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.nombre.toLowerCase().includes('admin') ? '👑' : '👷'} {r.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                            <i className="bi bi-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"></i>
                                        </div>
                                    </div>
                                </div>

                                {/* Contraseña */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">
                                        Contraseña {editingUser && <span className="text-orange-500 lowercase font-normal italic">(Opcional para mantener)</span>}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all"
                                            placeholder={editingUser ? "••••••••" : "Contraseña segura"}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#1e293b] bg-transparent border-0"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Estado de Cuenta */}
                                <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${formData.activo ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${formData.activo ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                            <i className={`bi ${formData.activo ? 'bi-shield-check' : 'bi-shield-x'}`}></i>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Estado de Cuenta</div>
                                            <div className={`font-black uppercase tracking-tight text-sm mt-1 ${formData.activo ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {formData.activo ? 'ACTIVA / ACCESO TOTAL' : 'BLOQUEADA / SIN ACCESO'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                                        className={`w-14 h-8 rounded-full relative transition-colors duration-300 border-0 ${formData.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 bottom-1 w-6 bg-white rounded-full transition-all duration-300 shadow-sm ${formData.activo ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>



                                {error && (
                                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-3 text-rose-600 animate-pulse">
                                        <i className="bi bi-exclamation-triangle-fill"></i>
                                        <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Fijo */}
                        <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0 rounded-b-3xl">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0f172a] text-white hover:bg-[#334155] transition-all shadow-lg shadow-[#0f172a]/20 border-0 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? 'Guardando...' : <><i className="bi bi-check-circle-fill"></i> Guardar Usuario</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN CUSTOM (Sustituye a Confirm del navegador) */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setConfirmModal({ ...confirmModal, show: false })}></div>
                    <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 text-center" style={{ zIndex: 10 }}>
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4 mx-auto shadow-inner ${confirmModal.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            <i className={`bi ${confirmModal.type === 'danger' ? 'bi-trash3-fill' : 'bi-exclamation-triangle-fill'}`}></i>
                        </div>
                        <h3 className="text-xl font-black text-[#1e293b] mb-2 uppercase tracking-tighter">{confirmModal.title}</h3>
                        <p className="text-[#64748b] text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                className="flex-1 px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0"
                            >
                                No, Cancelar
                            </button>
                            <button 
                                onClick={confirmModal.action}
                                className={`flex-1 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-lg border-0 ${confirmModal.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}
                            >
                                Sí, Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .admin-page-wrapper { min-height: 100vh; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif; }
                .main-content { max-width: 900px; margin: 0 auto; padding: 40px 20px; }

                /* Header */
                .header-container { background: white; border-radius: 24px; padding: 25px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .badge-system { display: inline-flex; align-items: center; gap: 8px; color: #2563eb; font-weight: 800; font-size: 0.7rem; margin-bottom: 10px; }
                .dot-pulse { width: 8px; height: 8px; background: #2563eb; border-radius: 50%; animation: p 2s infinite; }
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
                

                
                .user-tags { display: flex; gap: 6px; }
                .chip { padding: 4px 10px; border-radius: 50px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(0,0,0,0.05); }
                .chip-role.administrador { background: #e0e7ff; color: #4338ca; }
                .chip-role.trabajador { background: #f1f5f9; color: #475569; }
                .chip-status.active { background: #d1fae5; color: #065f46; }
                .chip-status.inactive { background: #f1f5f9; color: #94a3b8; }

                .card-actions { border-top: 1px solid #f1f5f9; padding-top: 15px; display: flex; gap: 8px; align-items: center; }
                .btn-c { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 15px; font-size: 0.8rem; font-weight: 700; transition: 0.2s; cursor: pointer; }
                .btn-c:hover { background: #f1f5f9; border-color: #cbd5e1; }
                .btn-warn { color: #d97706; }
                .btn-danger-solid { 
                    background: #ef4444; 
                    color: white; 
                    border: 1px solid #dc2626;
                    cursor: pointer;
                }
                .btn-danger-solid:hover { 
                    background: #b91c1c; 
                    border-color: #991b1b; 
                    box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);
                }
                .system-tag { font-size: 0.6rem; font-weight: 900; color: #cbd5e1; letter-spacing: 1px; }

                /* Modals - Premium Design (Optimized) */
                .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.7); display: flex; align-items: flex-start; justify-content: center; z-index: 1000; overflow-y: auto; padding: 20px; }
                .modal-content { background: white; border-radius: 24px; width: 100%; max-width: 520px; overflow: hidden; animation: slideUp 0.15s ease-out; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); margin: auto; display: flex; flex-direction: column; max-height: calc(100vh - 40px); }
                @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

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
                .close-modal-btn { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; font-size: 1.3rem; font-weight: 300; line-height: 1; }
                .close-modal-btn:hover { background: rgba(239,68,68,0.9); border-color: transparent; color: white; }

                /* Modal Body Premium */
                .modal-body-premium { padding: 24px; overflow-y: auto; flex: 1; }
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

                /* Password Toggle */
                .password-field-wrapper { position: relative; display: flex; align-items: center; }
                .password-field-wrapper input { flex: 1; padding-right: 36px; }
                .toggle-pass-btn { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px 6px; font-size: 1.1rem; display: flex; align-items: center; transition: color 0.2s; }
                .toggle-pass-btn:hover { color: var(--primary-500, #005d31); }

                /* Input Grid */
                .input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                @media (max-width: 500px) { .input-grid { grid-template-columns: 1fr; } }

                /* STATUS CARD - OPTIMIZED */
                .status-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 20px; margin-top: 8px; margin-bottom: 16px; transition: background 0.2s, border-color 0.2s; }
                .status-active { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; color: #10b981; }
                .status-inactive { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; color: #ef4444; }

                .status-visual { position: relative; }
                .status-icon-container { position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; }
                .status-icon-bg { position: absolute; inset: 0; border-radius: 16px; background: currentColor; opacity: 0.15; }
                .status-icon-container i { font-size: 1.6rem; }

                .status-info { flex: 1; }
                .status-title { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; margin-bottom: 6px; color: #1e293b; }
                .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; }
                .status-badge.active { background: #10b981; color: white; }
                .status-badge.inactive { background: #ef4444; color: white; }
                .status-description p { margin: 6px 0 0; font-size: 0.8rem; color: #64748b; }

                /* Custom Toggle Button */
                .status-toggle { flex-shrink: 0; }
                .toggle-btn { background: none; border: none; cursor: pointer; padding: 0; outline: none; }
                .toggle-track { display: block; width: 56px; height: 32px; border-radius: 50px; position: relative; transition: background 0.2s; }
                .toggle-on .toggle-track { background: #10b981; }
                .toggle-off .toggle-track { background: #94a3b8; }
                .toggle-thumb { position: absolute; top: 3px; width: 26px; height: 26px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; transition: left 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
                .toggle-on .toggle-thumb { left: 27px; color: #10b981; }
                .toggle-off .toggle-thumb { left: 3px; color: #64748b; }


                /* Error Banner */
                .error-banner { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: linear-gradient(135deg, #fef2f2, #fee2e2); border: 1px solid #fca5a5; border-radius: 14px; color: #b91c1c; font-size: 0.85rem; font-weight: 600; animation: shake 0.4s ease-in-out; }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
                .error-banner i { font-size: 1.1rem; }

                /* Modal Footer Premium */
                .modal-footer-premium { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; gap: 12px; flex-shrink: 0; }
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

                .loader-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-weight: 900; color: #2563eb; letter-spacing: 2px; }



                /* ===== RESPONSIVE ===== */
                @media (max-width: 640px) {
                    .main-content { padding: 20px 12px; }
                    .header-container { flex-direction: column; gap: 16px; text-align: center; padding: 20px 16px; border-radius: 18px; }
                    .header-stats { width: 100%; justify-content: center; }
                    .btn-add-premium { width: 100%; justify-content: center; }
                    .title { font-size: 1.3rem; }
                    .filters-bar { flex-direction: column; border-radius: 18px; padding: 12px; gap: 10px; }
                    .filter-select { width: 100%; }
                    .user-card { border-radius: 16px; padding: 16px; }
                    .card-top { flex-direction: column; gap: 12px; }
                    .user-tags { align-self: flex-start; }
                    .card-actions { flex-wrap: wrap; }
                    .card-actions .btn-c { flex: 1; min-width: 0; justify-content: center; text-align: center; font-size: 0.75rem; padding: 6px 10px; }

                    /* Modal responsive */
                    .modal-overlay { padding: 10px; }
                    .modal-content { border-radius: 20px; max-height: calc(100vh - 20px); }
                    .modal-header-premium { padding: 20px 16px 16px; }
                    .modal-avatar { width: 44px; height: 44px; font-size: 1.2rem; border-radius: 12px; }
                    .preview-name { font-size: 0.95rem; }
                    .preview-handle { font-size: 0.75rem; }
                    .modal-body-premium { padding: 16px; }
                    .modal-section-title { font-size: 0.8rem; margin-bottom: 14px; }
                    .premium-input-group { padding: 10px; margin-bottom: 12px; border-radius: 12px; }
                    .input-icon { width: 34px; height: 34px; border-radius: 10px; font-size: 0.95rem; }
                    .input-content label { font-size: 0.65rem; }
                    .input-content input, .input-content select { font-size: 0.85rem; padding: 6px 0; }
                    .status-card { padding: 14px; border-radius: 14px; gap: 12px; flex-wrap: wrap; }
                    .status-icon-container { width: 40px; height: 40px; }
                    .status-icon-container i { font-size: 1.3rem; }
                    .status-badge { font-size: 0.65rem; }
                    .status-description p { font-size: 0.75rem; }
                    .modal-footer-premium { padding: 14px 16px; flex-direction: row; }
                    .btn-modal-cancel { padding: 10px 16px; font-size: 0.8rem; flex: 1; justify-content: center; }
                    .btn-modal-save { padding: 10px 16px; font-size: 0.8rem; flex: 1; justify-content: center; }

                    /* Confirm box responsive */
                    .confirm-box { width: 90% !important; max-width: 320px; }
                }
            `}</style>
        </div>
    );
}
