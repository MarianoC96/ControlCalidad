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
        <div className="page-wrapper relative min-h-screen overflow-x-hidden">
            {/* Background Ambient Effects */}
            <div className="absolute top-0 right-0 w-full h-screen bg-[radial-gradient(circle_at_top_right,_var(--primary-100)_0%,_transparent_24%),_radial-gradient(circle_at_bottom_left,_var(--accent-100)_0%,_transparent_24%)] pointer-events-none -z-10 opacity-60"></div>

            <main className="main-content relative z-10">
                {/* Header Premium con Retorno y Stats */}
                <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => router.push('/dashboard')}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm group"
                            >
                                <i className="bi bi-arrow-left text-xl group-hover:-translate-x-1 transition-transform"></i>
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ring-1 ring-indigo-200">
                                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                                        Seguridad de Accesos
                                    </span>
                                </div>
                                <h1 className="text-4xl font-black text-[#1e293b] tracking-tighter uppercase m-0 leading-none">
                                    Gestión de Usuarios
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="bg-white border border-slate-200 rounded-2xl p-3 px-5 shadow-sm flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-xl font-black text-indigo-600 leading-none">{usuarios.length}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</div>
                                </div>
                                <div className="w-px h-8 bg-slate-100"></div>
                                <div className="text-center">
                                    <div className="text-xl font-black text-emerald-600 leading-none">{usuarios.filter(u => u.activo).length}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Activos</div>
                                </div>
                            </div>

                            <button 
                                className="bg-[#0f172a] text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center gap-3"
                                onClick={() => {
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
                                }}
                            >
                                <i className="bi bi-person-plus-fill text-lg"></i>
                                Nuevo Registro
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters con Estilo Moderno */}
                <div className="flex flex-col sm:flex-row gap-4 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="flex-1 relative group">
                        <i className="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"></i>
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre o usuario..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-[#1e293b] font-bold outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 shadow-sm"
                        />
                    </div>
                    <div className="relative">
                        <i className="bi bi-filter absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <select 
                            className="bg-white border border-slate-200 rounded-2xl pl-12 pr-10 py-4 text-[#1e293b] font-bold outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 shadow-sm appearance-none cursor-pointer min-w-[200px]"
                            value={roleFilter} 
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="all">TODOS LOS ROLES</option>
                            {rolesList.map(r => (
                                <option key={r.id} value={r.id.toString()}>{r.nombre.toUpperCase()}</option>
                            ))}
                        </select>
                        <i className="bi bi-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                    </div>
                </div>

                {/* Feed de Usuarios Premium */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {filteredUsuarios.map((user) => (
                        <div 
                            key={user.id} 
                            className={`group bg-white border border-slate-200 rounded-[32px] p-6 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1 relative overflow-hidden ${!user.activo ? 'opacity-70 animate-pulse-subtle' : ''}`}
                        >
                            {/* Blur Ambient Effect on Hover */}
                            <div className={`absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${user.roles === 'administrador' ? 'bg-indigo-600' : 'bg-blue-600'}`}></div>

                            <div className="relative flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg transition-transform duration-500 group-hover:scale-110 ${user.roles === 'administrador' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-200' : 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-200'}`}>
                                        {user.nombre_completo.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-[#1e293b] leading-tight group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                            {user.nombre_completo}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-bold text-indigo-500">@{user.usuario}</span>
                                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${user.activo ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {user.activo ? 'Cuenta Activa' : 'Cuenta Inactiva'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ${user.roles === 'administrador' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                                        {rolesList.find(r => r.id === user.role_id)?.nombre || user.roles}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                                {user.usuario !== 'sadmin' ? (
                                    <>
                                        <button 
                                            className="flex-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-indigo-100 flex items-center justify-center gap-2 active:scale-95"
                                            onClick={() => {
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
                                            }}
                                        >
                                            <i className="bi bi-pencil-square"></i> Perfil
                                        </button>
                                        <button 
                                            className="w-12 h-11 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border border-transparent hover:border-rose-100 flex items-center justify-center active:scale-90"
                                            onClick={() => openDisableConfirm(user)}
                                            title="Eliminar Personal"
                                        >
                                            <i className="bi bi-trash3-fill"></i>
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full py-3 bg-slate-900/5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <i className="bi bi-shield-lock-fill text-slate-500"></i>
                                        Protegido por Sistema
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredUsuarios.length === 0 && (
                        <div className="col-span-1 md:col-span-2 py-20 bg-white border border-slate-200 rounded-[40px] border-dashed flex flex-col items-center text-center px-10">
                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-3xl text-slate-300 mb-6 border border-slate-100">
                                <i className="bi bi-people"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sin coincidencias</h3>
                            <p className="text-slate-500 text-sm max-w-xs mt-2 font-medium">No encontramos personal que coincida con tu búsqueda actual.</p>
                            <button 
                                onClick={() => {setSearchTerm(''); setRoleFilter('all');}}
                                className="mt-6 text-indigo-600 font-bold text-xs uppercase tracking-widest hover:underline"
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    )}
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
                .page-wrapper {
                    padding-top: 60px; /* Altura del header móvil */
                    transition: all 0.3s ease;
                }

                @media (min-width: 992px) {
                    .page-wrapper {
                        padding-top: 0;
                    }
                }

                .main-content {
                    max-width: 1300px;
                    margin: 0 auto;
                    padding: 40px 24px;
                }

                @keyframes pulse-subtle {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 0.5; }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 3s infinite ease-in-out;
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f8fafc;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }

                .animate-in {
                    animation: animate-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                @keyframes animate-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 768px) {
                    .main-content {
                        padding: 24px 16px;
                    }
                }
            `}</style>
        </div>
    );
}
