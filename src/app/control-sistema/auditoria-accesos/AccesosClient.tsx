'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';


interface Permission {
    id: number;
    role_id: number;
    modulo_key: string;
    habilitado: boolean;
}

interface Role {
    id: number;
    nombre: string;
    descripcion: string | null;
    is_system: boolean;
    permisos: Permission[];
}

const MODULE_LABELS: Record<string, string> = {
    'registro-productos': 'Registrar',
    'historial': 'Historial',
    'historial-descargas': 'Historial de Descargas',
    'historial-descargas-masivas': 'Historial de Descargas Masivas',
    'registros-modificados': 'Registros Modificados',
    'solicitudes': 'Solicitudes',
    'productos': 'Productos',
    'parametros-maestros': 'Parámetros Maestros',
    'usuarios': 'Usuarios',
    'admin/config-pdf': 'Edición de PDF',
    'admin/config-reportes': 'Config. Reportes',
    'accesos': 'Accesos a Sistema',
    'control-sistema': 'Control del Sistema (Padre)',
    'control-calidad': 'Control de Calidad (Padre)',
    'escaneo': 'Escaneo de Códigos (Padre)',
    'escaneo-productos': 'Sección: Agregar Productos',
    'escaneo-cajas': 'Sección: Agregar Cajas',
    'escaneo-historial': 'Historial Logístico',
    'escaneo-central': 'Escaner Central',
};

export default function AccesosClient() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [modules, setModules] = useState<string[]>([]);
    const [isSadmin, setIsSadmin] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showNewRoleModal, setShowNewRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');
    const [newRolePermisos, setNewRolePermisos] = useState<string[]>([]);
    const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('administrador');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRoles = roles.filter(role => 
        role.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const getCookie = (name: string) => {
            const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
            return v ? decodeURIComponent(v[2]) : '';
        };
        setUserName(getCookie('user_name'));
        setUserRole(getCookie('user_role') as 'administrador' | 'trabajador');
    }, []);

    const fetchRoles = useCallback(async () => {
        try {
            const res = await fetch('/api/roles');
            if (!res.ok) {
                if (res.status === 403) {
                    setError('No tienes permisos para acceder a este módulo');
                    return;
                }
                throw new Error('Error al cargar roles');
            }
            const data = await res.json();
            setRoles(data.roles || []);
            setModules(data.modules || []);
            setIsSadmin(data.isSadmin || false);
        } catch (e) {
            setError('Error al cargar los roles');
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const handleTogglePermission = (moduleKey: string) => {
        if (!selectedRole || selectedRole.is_system) return;
        if (moduleKey === 'accesos' && !isSadmin) return;

        let newPermisos = selectedRole.permisos.map(p => ({ ...p }));

        const existingIndex = newPermisos.findIndex(p => p.modulo_key === moduleKey);
        const nextState = existingIndex >= 0 ? !newPermisos[existingIndex].habilitado : true;

        if (existingIndex >= 0) {
            newPermisos[existingIndex].habilitado = nextState;
        } else {
            newPermisos.push({ id: Date.now(), role_id: selectedRole.id, modulo_key: moduleKey, habilitado: true });
        }

        // Parent/Child Cascade Logic
        const systemChildren = ['usuarios', 'admin/config-pdf', 'admin/config-reportes', 'accesos'];
        const qualityChildren = ['registro-productos', 'historial', 'productos', 'parametros-maestros', 'registros-modificados', 'historial-descargas-masivas'];
        const scannerChildren = ['escaneo-productos', 'escaneo-cajas', 'escaneo-historial', 'escaneo-central'];

        // If disabling a parent, disable all children
        if (moduleKey === 'control-sistema' && !nextState) {
            systemChildren.forEach(child => {
                const cIdx = newPermisos.findIndex(p => p.modulo_key === child);
                if (cIdx >= 0) newPermisos[cIdx].habilitado = false;
            });
        }
        if (moduleKey === 'control-calidad' && !nextState) {
            qualityChildren.forEach(child => {
                const cIdx = newPermisos.findIndex(p => p.modulo_key === child);
                if (cIdx >= 0) newPermisos[cIdx].habilitado = false;
            });
        }
        if (moduleKey === 'escaneo' && !nextState) {
            scannerChildren.forEach(child => {
                const cIdx = newPermisos.findIndex(p => p.modulo_key === child);
                if (cIdx >= 0) newPermisos[cIdx].habilitado = false;
            });
        }

        // If enabling a child, enable the parent
        if (systemChildren.includes(moduleKey) && nextState) {
            const pIdx = newPermisos.findIndex(p => p.modulo_key === 'control-sistema');
            if (pIdx >= 0) newPermisos[pIdx].habilitado = true;
            else newPermisos.push({ id: Date.now() + 1, role_id: selectedRole.id, modulo_key: 'control-sistema', habilitado: true });
        }
        if (qualityChildren.includes(moduleKey) && nextState) {
            const pIdx = newPermisos.findIndex(p => p.modulo_key === 'control-calidad');
            if (pIdx >= 0) newPermisos[pIdx].habilitado = true;
            else newPermisos.push({ id: Date.now() + 2, role_id: selectedRole.id, modulo_key: 'control-calidad', habilitado: true });
        }
        if (scannerChildren.includes(moduleKey) && nextState) {
            const pIdx = newPermisos.findIndex(p => p.modulo_key === 'escaneo');
            if (pIdx >= 0) newPermisos[pIdx].habilitado = true;
            else newPermisos.push({ id: Date.now() + 3, role_id: selectedRole.id, modulo_key: 'escaneo', habilitado: true });
        }

        setSelectedRole({ ...selectedRole, permisos: newPermisos });
    };

    const handleSavePermissions = async () => {
        if (!selectedRole || selectedRole.is_system) return;
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const enabledModules = selectedRole.permisos.filter(p => p.habilitado).map(p => p.modulo_key);
            const res = await fetch('/api/roles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedRole.id, descripcion: selectedRole.descripcion, permisos: enabledModules }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
            setSuccess('Permisos guardados correctamente');
            setTimeout(() => setSuccess(''), 3000);
            await fetchRoles();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error al guardar permisos';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCloseModal = useCallback(() => {
        setShowNewRoleModal(false);
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRolePermisos([]);
        setError('');
    }, []);

    const handleToggleNewRolePermission = useCallback((mod: string) => {
        setNewRolePermisos(prev => {
            const nextState = !prev.includes(mod);
            let nextPerms = nextState ? [...prev, mod] : prev.filter(p => p !== mod);

            const systemChildren = ['usuarios', 'admin/config-pdf', 'admin/config-reportes', 'accesos'];
            const qualityChildren = ['registro-productos', 'historial', 'productos', 'parametros-maestros', 'registros-modificados', 'historial-descargas-masivas'];
            const scannerChildren = ['escaneo-productos', 'escaneo-cajas', 'escaneo-historial', 'escaneo-central'];

            // Parent Disable => Child Disable
            if (mod === 'control-sistema' && !nextState) nextPerms = nextPerms.filter(p => !systemChildren.includes(p));
            if (mod === 'control-calidad' && !nextState) nextPerms = nextPerms.filter(p => !qualityChildren.includes(p));
            if (mod === 'escaneo' && !nextState) nextPerms = nextPerms.filter(p => !scannerChildren.includes(p));

            // Child Enable => Parent Enable
            if (systemChildren.includes(mod) && nextState && !nextPerms.includes('control-sistema')) nextPerms.push('control-sistema');
            if (qualityChildren.includes(mod) && nextState && !nextPerms.includes('control-calidad')) nextPerms.push('control-calidad');
            if (scannerChildren.includes(mod) && nextState && !nextPerms.includes('escaneo')) nextPerms.push('escaneo');

            return nextPerms;
        });
    }, []);

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) { setError('El nombre del rol es obligatorio'); return; }
        if (newRoleName.trim().toLowerCase() === 'sadmin') {
            setError('El nombre "sadmin" está reservado para el sistema');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: newRoleName.trim(), descripcion: newRoleDesc.trim() || null, permisos: newRolePermisos }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al crear rol');
            setSuccess(`Rol "${newRoleName}" creado correctamente`);
            handleCloseModal();
            setTimeout(() => setSuccess(''), 3000);
            await fetchRoles();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error al crear rol';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (role: Role) => {
        try {
            const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al eliminar');
            setSuccess(`Rol "${role.nombre}" eliminado`);
            setConfirmDelete(null);
            if (selectedRole?.id === role.id) setSelectedRole(null);
            setTimeout(() => setSuccess(''), 3000);
            await fetchRoles();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error al eliminar';
            setError(msg);
            setConfirmDelete(null);
        }
    };

    const handleMoveRole = async (roleId: number, direction: 'up' | 'down') => {
        // Filter out system roles — they stay pinned at top
        const nonSystemRoles = roles.filter(r => !r.is_system);
        const idx = nonSystemRoles.findIndex(r => r.id === roleId);
        if (idx < 0) return;
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === nonSystemRoles.length - 1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const reordered = [...nonSystemRoles];
        [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

        // Build new order: system roles first (unchanged), then reordered non-system
        const systemRoles = roles.filter(r => r.is_system);
        const newRoles = [...systemRoles, ...reordered];
        setRoles(newRoles);

        // Persist positions
        try {
            const order = reordered.map((r, i) => ({ id: r.id, posicion: i + 1 }));
            await fetch('/api/roles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order }),
            });
        } catch (e) {
            console.error('Error al reordenar:', e);
            await fetchRoles(); // revert on error
        }
    };

    if (loading) {
        return <LoadingOverlay message="Cargando Permisos..." />;
    }

    return (
        <div className="page-wrapper">
                <div className="main-content">
                    {/* Header */}
                    <div className="page-header">
                        <div className="header-left">
                            <div className="header-icon-box">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="28" height="28"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div>
                                <h1 className="page-title">Accesos a Sistema</h1>
                                <p className="page-subtitle">Gestiona los roles y permisos de acceso a módulos</p>
                            </div>
                        </div>
                        <button className="btn-create" onClick={() => setShowNewRoleModal(true)}>
                            <div className="btn-icon-bg">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <span>Nuevo Rol</span>
                        </button>
                    </div>

                    {/* Alerts */}
                    {error && (
                        <div className="alert alert-error">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            <span>{error}</span>
                            <button onClick={() => setError('')}>×</button>
                        </div>
                    )}
                    {success && (
                        <div className="alert alert-success">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{success}</span>
                        </div>
                    )}

                    <div className="content-grid">
                        {/* Roles List */}
                        <div className="roles-panel">
                            <div className="panel-header">
                                <div className="flex flex-col gap-1">
                                    <h2>Roles del Sistema</h2>
                                    <span className="text-[10px] font-bold text-[#58623f] uppercase tracking-wider">Gestión de Acceso</span>
                                </div>
                                <span className="badge-count">{filteredRoles.length}</span>
                            </div>

                            {/* Búsqueda Inteligente */}
                            <div className="search-box-container">
                                <i className="bi bi-search search-icon"></i>
                                <input 
                                    type="text" 
                                    placeholder="Buscar rol por nombre..." 
                                    className="search-input"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button className="clear-search" onClick={() => setSearchTerm('')}>
                                        <i className="bi bi-x-circle-fill"></i>
                                    </button>
                                )}
                            </div>

                            <div className="roles-list custom-scrollbar">
                                {filteredRoles.map((role, index) => {
                                    const nonSystemRoles = roles.filter(r => !r.is_system);
                                    const nonSystemIdx = nonSystemRoles.findIndex(r => r.id === role.id);
                                    const isFirst = nonSystemIdx === 0;
                                    const isLast = nonSystemIdx === nonSystemRoles.length - 1;

                                    return (
                                        <div
                                            key={role.id}
                                            className={`role-card ${selectedRole?.id === role.id ? 'selected' : ''} ${role.is_system ? 'system' : ''}`}
                                            onClick={() => setSelectedRole(role)}
                                        >
                                            <div className="role-card-top">
                                                <div className={`role-avatar ${role.is_system ? 'avatar-system' : 'avatar-admin'}`}>
                                                    {role.is_system ? '👑' : role.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="role-info">
                                                    <div className="role-name">
                                                        {role.nombre}
                                                        {role.is_system && <span className="system-badge">SISTEMA</span>}
                                                    </div>
                                                    <div className="role-desc">{role.descripcion || 'Sin descripción'}</div>
                                                    <div className="role-meta">
                                                        <span className="meta-item">
                                                            Módulos: <strong>{role.permisos.filter(p => p.habilitado && modules.includes(p.modulo_key)).length}/{modules.length}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {!role.is_system && (
                                                <div className="role-actions">
                                                    <div className="reorder-btns">
                                                        <button
                                                            className="btn-reorder"
                                                            onClick={(e) => { e.stopPropagation(); handleMoveRole(role.id, 'up'); }}
                                                            disabled={isFirst}
                                                            title="Mover arriba"
                                                        >
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                                                        </button>
                                                        <button
                                                            className="btn-reorder"
                                                            onClick={(e) => { e.stopPropagation(); handleMoveRole(role.id, 'down'); }}
                                                            disabled={isLast}
                                                            title="Mover abajo"
                                                        >
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                                        </button>
                                                    </div>
                                                    <button
                                                        className="btn-delete-role"
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(role); }}
                                                        title="Eliminar rol"
                                                    >
                                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Permissions Panel */}
                        <div className="perms-panel">
                            {selectedRole ? (
                                <>
                                    <div className="panel-header">
                                        <h2>Permisos: <span className="hl">{selectedRole.nombre}</span></h2>
                                        {selectedRole.is_system && (
                                            <span className="lock-badge">
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                Bloqueado
                                            </span>
                                        )}
                                    </div>

                                    {selectedRole.is_system && (
                                        <div className="system-notice">
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>Este rol del sistema tiene acceso total y no puede ser modificado. Solo el usuario <strong>@sadmin</strong> posee este rol.</span>
                                        </div>
                                    )}

                                    {/* Editable Description */}
                                    {!selectedRole.is_system && (
                                        <div className="desc-edit-section">
                                            <label className="desc-edit-label">
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                Descripción del Rol
                                            </label>
                                            <textarea
                                                className={`desc-textarea ${selectedRole.is_system ? 'opacity-60 pointer-events-none' : ''}`}
                                                value={selectedRole.descripcion || ''}
                                                onChange={e => setSelectedRole({ ...selectedRole, descripcion: e.target.value })}
                                                placeholder={selectedRole.is_system ? 'Descripción protegida por el sistema' : 'Describe brevemente el propósito de este rol...'}
                                                rows={2}
                                                readOnly={selectedRole.is_system}
                                            />
                                        </div>
                                    )}

                                    {/* Módulos Agrupados por Padres */}
                                    <div className="space-y-8 p-6">
                                        {[
                                            {
                                                id: 'control-sistema',
                                                label: 'Control del Sistema',
                                                icon: 'bi-cpu-fill',
                                                color: 'indigo',
                                                children: ['usuarios', 'accesos', 'admin/config-pdf', 'admin/config-reportes']
                                            },
                                            {
                                                id: 'control-calidad',
                                                label: 'Control de Calidad',
                                                icon: 'bi-check-all',
                                                color: 'emerald',
                                                children: ['registro-productos', 'historial', 'productos', 'parametros-maestros', 'registros-modificados', 'historial-descargas-masivas']
                                            },
                                            {
                                                id: 'escaneo',
                                                label: 'Escaneo de Códigos',
                                                icon: 'bi-upc-scan',
                                                color: 'blue',
                                                children: ['escaneo-productos', 'escaneo-cajas', 'escaneo-historial', 'escaneo-central']
                                            }
                                        ].map(parent => {
                                            const parentPerm = selectedRole.permisos.find(p => p.modulo_key === parent.id);
                                            const parentEnabled = parentPerm?.habilitado ?? false;
                                            const parentLocked = selectedRole.is_system;

                                            // El Olivar Sobrio color mapping (Refined)
                                            const colorMap: Record<string, any> = {
                                                indigo: {
                                                    bgLight: 'bg-[#f1f3ed]', 
                                                    bgMain: 'bg-[#005d31]',  
                                                    bgMuted: 'bg-[#e2e8d8]',
                                                    border: 'border-[#005d31]/30',
                                                    text: 'text-[#005d31]',
                                                    textMain: 'text-[#004d29]', // Aclarado para que no parezca negro
                                                    toggle: 'bg-[#005d31]'
                                                },
                                                emerald: {
                                                    bgLight: 'bg-[#f4f4f0]',
                                                    bgMain: 'bg-[#58623f]',  
                                                    bgMuted: 'bg-[#e5e5dc]',
                                                    border: 'border-[#58623f]/30',
                                                    text: 'text-[#58623f]',
                                                    textMain: 'text-[#3a412a]',
                                                    toggle: 'bg-[#58623f]'
                                                },
                                                blue: {
                                                    bgLight: 'bg-[#f1f3ed]',
                                                    bgMain: 'bg-[#004d29]',
                                                    bgMuted: 'bg-[#e2e8d8]',
                                                    border: 'border-[#004d29]/30',
                                                    text: 'text-[#004d29]',
                                                    textMain: 'text-[#005d31]',
                                                    toggle: 'bg-[#004d29]'
                                                }
                                            };

                                            const colors = colorMap[parent.color] || colorMap.indigo;

                                            return (
                                                <div key={parent.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm relative">
                                                    {/* Parent Header */}
                                                    <div className={`p-5 flex items-center justify-between transition-colors ${parentEnabled ? colors.bgLight : 'bg-slate-50'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${parentEnabled ? `${colors.bgMain} text-white` : 'bg-slate-200 text-slate-400'}`}>
                                                                <i className={`bi ${parent.icon}`}></i>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <h4 className="text-sm font-black text-[#1e293b] uppercase tracking-tight m-0">{parent.label}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest m-0">{parentEnabled ? 'Grupo Activo' : 'Grupo Bloqueado'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {!parentLocked ? (
                                                                <div 
                                                                    className={`w-14 h-7 rounded-full relative cursor-pointer transition-all duration-300 ${parentEnabled ? colors.toggle : 'bg-slate-300'}`}
                                                                    onClick={() => handleTogglePermission(parent.id)}
                                                                >
                                                                    <div className={`absolute top-1 bottom-1 w-5 bg-white rounded-full transition-all duration-300 shadow-sm ${parentEnabled ? 'right-1' : 'left-1'}`}></div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-[#f1f3ed] text-[#58623f] text-[10px] font-black px-3 py-1 rounded-full uppercase italic ring-1 ring-[#e2e8d8]">Sistema</div>
                                                            )}
                                                        </div>
                                                    </div>


                                                    {/* Children Grid */}
                                                    <div className={`p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all ${parentEnabled ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                                        {parent.children.map(child => {
                                                            const childPerm = selectedRole.permisos.find(p => p.modulo_key === child);
                                                            const childEnabled = childPerm?.habilitado ?? false;
                                                            return (
                                                                <div 
                                                                    key={child}
                                                                    onClick={() => !parentLocked && parentEnabled && handleTogglePermission(child)}
                                                                    className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${childEnabled ? `bg-white ${colors.border} shadow-md transform -translate-y-0.5` : 'bg-[#f8faf5] border-[#e2e8d8] hover:border-[#c5cdba]'}`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${childEnabled ? `${colors.bgMuted} ${colors.text}` : 'bg-white text-slate-300 border border-slate-100'}`}>
                                                                            {childEnabled ? <i className="bi bi-check-lg"></i> : <i className="bi bi-dash"></i>}
                                                                        </div>
                                                                        <span className={`text-xs font-bold leading-none ${childEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                                                                            {MODULE_LABELS[child]?.replace('Sección: ', '') || child}
                                                                        </span>
                                                                    </div>
                                                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${childEnabled ? colors.bgMain : 'bg-slate-200'}`}>
                                                                        <div className={`absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${childEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Acceso Universal: Centro de Solicitudes */}
                                        <div className="rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group" style={{ background: 'linear-gradient(135deg, #164e33, #004d29)' }}>
                                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                                <i className="bi bi-clock-history text-8xl"></i>
                                            </div>
                                            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl border border-white/20 shadow-2xl">
                                                        <i className="bi bi-person-workspace text-[#969836]"></i>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black uppercase tracking-tight m-0 text-white">Centro de Solicitudes</h4>
                                                        <p className="text-xs font-medium text-emerald-100/80 m-0">Acceso Universal Transversal</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <div 
                                                        className={`w-20 h-9 rounded-full relative cursor-pointer transition-all duration-300 ${selectedRole.permisos.find(p => p.modulo_key === 'solicitudes')?.habilitado ? 'bg-[#969836] shadow-[0_0_20px_rgba(150,152,54,0.4)]' : 'bg-slate-700'}`}
                                                        onClick={() => !selectedRole.is_system && handleTogglePermission('solicitudes')}
                                                    >
                                                        <div className={`absolute top-1 bottom-1 w-7 bg-white rounded-full transition-all duration-300 shadow-sm ${(selectedRole.permisos.find(p => p.modulo_key === 'solicitudes')?.habilitado) ? 'right-1' : 'left-1'}`}></div>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-50/70">
                                                        {(selectedRole.permisos.find(p => p.modulo_key === 'solicitudes')?.habilitado) ? 'Acceso Permitido' : 'Acceso Restringido'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {!selectedRole.is_system && (
                                        <div className="save-bar">
                                            <button
                                                className="btn-save"
                                                onClick={handleSavePermissions}
                                                disabled={saving}
                                            >
                                                {saving ? <span className="spinner"></span> : <><i className="bi bi-save-fill"></i> Guardar Cambios</>}
                                            </button>
                                        </div>
                                    )}
                                </>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                </div>
                                <h3>Selecciona un rol</h3>
                                <p>Haz clic en un rol de la lista para ver y modificar sus permisos de acceso a módulos del sistema.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showNewRoleModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#003019]/80 backdrop-blur-sm" onClick={handleCloseModal}></div>
                    <div className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-2xl max-h-[90vh]" style={{ zIndex: 10 }} onClick={e => e.stopPropagation()}>
                        
                        {/* Header Estilo Historial */}
                        <div className="p-5 sm:p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                    <i className="bi bi-shield-lock-fill"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">
                                        Crear Nuevo Rol
                                    </h3>
                                    <p className="text-[#64748b] text-[10px] font-bold uppercase tracking-widest mt-1 mb-0">Gestión de Privilegios y Accesos</p>
                                </div>
                            </div>
                            <button onClick={handleCloseModal} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] flex items-center justify-center text-[#1e293b] transition-transform active:scale-90 border-0 shadow-sm">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        {/* Body Scrollable */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="space-y-6">
                                {/* Nombre del Rol */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Nombre del Rol <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newRoleName}
                                            onChange={e => setNewRoleName(e.target.value)}
                                            className="w-full bg-white border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] font-bold focus:border-[#0f172a] outline-none transition-all uppercase tracking-wider"
                                            placeholder="Ej: SUPERVISOR, AUDITOR..."
                                            autoFocus
                                        />
                                        <i className="bi bi-person-badge absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                                    </div>
                                </div>

                                {/* Descripción */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Descripción</label>
                                    <textarea
                                        value={newRoleDesc}
                                        onChange={e => setNewRoleDesc(e.target.value)}
                                        rows={2}
                                        className="w-full bg-white border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] outline-none transition-all resize-none"
                                        placeholder="Describe el propósito de este rol..."
                                    />
                                </div>

                                <div className="space-y-4 pt-2">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2">
                                                <i className="bi bi-grid-fill text-[#004d29]"></i>
                                                <span className="text-xs font-black text-[#004d29] uppercase tracking-widest">Configuración de Privilegios</span>
                                            </div>
                                            <span className="text-[10px] font-black bg-[#f1f3ed] text-[#58623f] px-3 py-1 rounded-full uppercase">
                                                {newRolePermisos.length} / {modules.filter(m => isSadmin || m !== 'accesos').length} seleccionados
                                            </span>
                                        </div>

                                        <div className="space-y-4">
                                            {/* SECCIÓN: ACCESO UNIVERSAL */}
                                            {modules.includes('solicitudes') && (
                                                <div className="p-4 rounded-2xl border border-[#e2e8d8] bg-[#f8faf5] flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-[#969836] text-white flex items-center justify-center text-lg shadow-sm">
                                                            <i className="bi bi-person-workspace"></i>
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-black text-[#004d29] block">Centro de Solicitudes</span>
                                                            <span className="text-[10px] font-bold text-[#7b7c2b] uppercase tracking-tighter">Acceso Universal</span>
                                                        </div>
                                                    </div>
                                                    <div 
                                                        className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${newRolePermisos.includes('solicitudes') ? 'bg-[#969836]' : 'bg-[#cbd5e1]'}`}
                                                        onClick={() => handleToggleNewRolePermission('solicitudes')}
                                                    >
                                                        <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${newRolePermisos.includes('solicitudes') ? 'right-1' : 'left-1'}`}></div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* AGRUPACIÓN DINÁMICA: PADRES E HIJOS */}
                                            {[
                                                { key: 'control-sistema', label: 'Control del Sistema', icon: 'bi-cpu-fill', children: ['usuarios', 'admin/config-pdf', 'admin/config-reportes', 'accesos'], color: { bg: 'bg-[#004d29]', border: 'border-[#004d29]', text: 'text-[#004d29]', bgMuted: 'bg-[#eef2ea]' } },
                                                { key: 'control-calidad', label: 'Control de Calidad', icon: 'bi-shield-check', children: ['registro-productos', 'historial', 'productos', 'parametros-maestros', 'registros-modificados', 'historial-descargas-masivas'], color: { bg: 'bg-[#58623f]', border: 'border-[#58623f]', text: 'text-[#58623f]', bgMuted: 'bg-[#f4f5f0]' } },
                                                { key: 'escaneo', label: 'Escaneo de Códigos', icon: 'bi-upc-scan', children: ['escaneo-productos', 'escaneo-cajas', 'escaneo-historial', 'escaneo-central'], color: { bg: 'bg-[#7b7c2b]', border: 'border-[#7b7c2b]', text: 'text-[#7b7c2b]', bgMuted: 'bg-[#f8faf5]' } }
                                            ].map((group) => {
                                                const parentEnabled = newRolePermisos.includes(group.key);
                                                return (
                                                    <div key={group.key} className="bg-white border border-[#e2e8d8] rounded-2xl overflow-hidden shadow-sm">
                                                        {/* Header del Padre */}
                                                        <div 
                                                            className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${parentEnabled ? group.color.bgMuted : 'bg-gray-50'}`}
                                                            onClick={() => handleToggleNewRolePermission(group.key)}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${parentEnabled ? `${group.color.bg} text-white` : 'bg-white text-slate-300 border border-slate-100'}`}>
                                                                    <i className={`bi ${group.icon}`}></i>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className={`text-sm font-black uppercase tracking-tight ${parentEnabled ? group.color.text : 'text-slate-400'}`}>{group.label}</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{parentEnabled ? 'Grupo Habilitado' : 'Grupo Bloqueado'}</span>
                                                                </div>
                                                            </div>
                                                            <div className={`w-12 h-6 rounded-full relative transition-colors ${parentEnabled ? group.color.bg : 'bg-slate-200'}`}>
                                                                <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${parentEnabled ? 'right-1' : 'left-1'}`}></div>
                                                            </div>
                                                        </div>

                                                        {/* Lista de Hijos */}
                                                        <div className={`p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white transition-all duration-300 ${parentEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                                                            {group.children.filter(child => isSadmin || child !== 'accesos').map(child => {
                                                                const childEnabled = newRolePermisos.includes(child);
                                                                return (
                                                                    <div 
                                                                        key={child}
                                                                        onClick={() => parentEnabled && handleToggleNewRolePermission(child)}
                                                                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${childEnabled ? `bg-white ${group.color.border} shadow-sm transform -translate-y-0.5` : 'bg-[#f8faf5] border-[#e2e8d8]'}`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${childEnabled ? `${group.color.bgMuted} ${group.color.text}` : 'bg-white text-slate-200'}`}>
                                                                                {childEnabled ? <i className="bi bi-check-lg"></i> : <i className="bi bi-dash"></i>}
                                                                            </div>
                                                                            <span className={`text-[10px] font-bold leading-none ${childEnabled ? 'text-slate-900' : 'text-slate-400'}`}>
                                                                                {MODULE_LABELS[child]?.replace('Sección: ', '') || child}
                                                                            </span>
                                                                        </div>
                                                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${childEnabled ? group.color.bg : 'bg-slate-200'}`}>
                                                                            <div className={`absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${childEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Fijo */}
                            <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0 rounded-b-3xl">
                                <button
                                    onClick={handleCloseModal}
                                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateRole}
                                    disabled={saving || !newRoleName.trim() || newRolePermisos.length === 0}
                                    className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#004d29] text-white hover:bg-[#005d31] transition-all shadow-lg shadow-[#004d29]/20 border-0 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? 'Guardando...' : <><i className="bi bi-check-circle-fill"></i> Crear Rol</>}
                                </button>
                            </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#003019]/80 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}></div>
                    <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 text-center">
                        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 text-3xl mx-auto mb-6">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                        </div>
                        <h3 className="text-xl font-black text-[#004d29] mb-3">¿Eliminar rol?</h3>
                        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                            Esta acción eliminará permanentemente el rol <strong className="text-[#004d29]">&ldquo;{confirmDelete?.nombre}&rdquo;</strong>. Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                onClick={() => setConfirmDelete(null)}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                                onClick={() => confirmDelete && handleDeleteRole(confirmDelete)}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-wrapper { min-height: 100vh; background: #f8fafc; font-family: 'Inter', system-ui, sans-serif; }
                .main-content { max-width: 1200px; margin: 0 auto; padding: 40px 32px; }

                .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; gap: 16px; flex-wrap: wrap; }
                .header-left { display: flex; align-items: center; gap: 18px; }
                .header-icon-box { width: 56px; height: 56px; background: #004d29; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 20px -4px rgba(0,77,41,0.3); }
                .page-title { font-size: 1.8rem; font-weight: 800; color: #004d29; margin: 0; letter-spacing: -0.02em; }
                .page-subtitle { font-size: 0.9rem; color: #58623f; margin: 4px 0 0; font-weight: 500; }

                .btn-create { display: flex; align-items: center; gap: 10px; padding: 10px 20px 10px 14px; background: linear-gradient(135deg, #005d31, #58623f); color: white; border: none; border-radius: 16px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.25s; box-shadow: 0 8px 20px -6px rgba(0,93,49,0.4); }
                .btn-create:hover { transform: translateY(-2px); box-shadow: 0 12px 25px -8px rgba(0,93,49,0.5); background: linear-gradient(135deg, #004d29, #3a412a); }
                .btn-icon-bg { width: 28px; height: 28px; background: rgba(255,255,255,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center; }

                .alert { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 16px; font-size: 0.9rem; font-weight: 600; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
                .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
                .alert button { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: inherit; margin-left: auto; opacity: 0.6; }
                .alert button:hover { opacity: 1; }

                .content-grid { display: grid; grid-template-columns: 340px 1fr; gap: 32px; align-items: start; }

                .roles-panel { background: white; border-radius: 24px; border: 1px solid #e2e8d8; overflow: hidden; box-shadow: 0 10px 30px -10px rgba(0,77,41,0.08); display: flex; flex-direction: column; max-height: 800px; }
                .perms-panel { background: white; border-radius: 24px; border: 1px solid #e2e8d8; overflow: hidden; box-shadow: 0 10px 30px -10px rgba(0,77,41,0.08); }
                .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #f1f3ed; background: #fff; flex-shrink: 0; }
                .panel-header h2 { font-size: 1.05rem; font-weight: 800; color: #004d29; margin: 0; }
                .badge-count { background: #f1f3ed; color: #58623f; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 50px; }
                .hl { color: #005d31; }

                .search-box-container { padding: 12px 20px; border-bottom: 1px solid #f1f3ed; background: #f8faf5; position: relative; display: flex; align-items: center; flex-shrink: 0; }
                .search-icon { position: absolute; left: 34px; color: #58623f; font-size: 0.9rem; pointer-events: none; }
                .search-input { width: 100%; height: 42px; background: white; border: 1.5px solid #e2e8d8; border-radius: 12px; padding: 0 40px 0 45px; font-size: 0.85rem; font-weight: 600; color: #004d29; outline: none; transition: all 0.2s; }
                .search-input:focus { border-color: #005d31; box-shadow: 0 0 0 3px rgba(0,93,49,0.05); }
                .clear-search { position: absolute; right: 30px; border: none; background: transparent; color: #c5cdba; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
                .clear-search:hover { color: #58623f; }

                .roles-list { padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
                .role-card { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 16px; border-radius: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.25,0.8,0.25,1); border: 1px solid transparent; background: white; position: relative; }
                .role-card:hover { background: #f1f3ed; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,48,25,0.05); }
                .role-card.selected { background: #eef2ea; border-color: #c5cdba; box-shadow: 0 4px 12px rgba(0,93,49,0.08); }
                .role-card.selected::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #005d31; border-radius: 4px 0 0 4px; }
                .role-card.system { background: linear-gradient(135deg, #f8faf5, #f1f3ed); border: 1px solid #e2e8d8; }
                .role-card.system.selected { background: #f1f3ed; border-color: #969836; }
                .role-card.system.selected::before { background: #969836; }
                
                .role-card-top { display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 0; }
                .role-avatar { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800; color: white; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .avatar-system { background: #7b7c2b; }
                .avatar-admin { background: #004d29; }

                .role-info { min-width: 0; }
                .role-name { font-weight: 800; font-size: 0.95rem; color: #004d29; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; line-height: 1.2; }
                .system-badge { background: #969836; color: white; font-size: 0.55rem; font-weight: 900; padding: 2px 8px; border-radius: 50px; letter-spacing: 1px; flex-shrink: 0; }
                .role-desc { font-size: 0.78rem; color: #64748b; margin-top: 2px; line-height: 1.4; word-break: break-word; }
                .role-meta { margin-top: 6px; }
                .meta-item { font-size: 0.72rem; color: #7b7c2b; }
                .meta-item strong { color: #005d31; }
                .role-card.selected .meta-item { color: #004d29; }

                .btn-delete-role { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #cbd5e1; transition: all 0.2s; background: transparent; border: none; cursor: pointer; }
                .btn-delete-role:hover { background: #fee2e2; color: #ef4444; }

                .role-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
                .reorder-btns { display: flex; flex-direction: column; gap: 2px; }
                .btn-reorder { width: 24px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: #94a3b8; transition: all 0.15s; background: transparent; border: 1px solid transparent; cursor: pointer; padding: 0; }
                .btn-reorder:hover:not(:disabled) { background: #eef2ff; color: #6366f1; border-color: #c7d2fe; }
                .btn-reorder:disabled { opacity: 0.25; cursor: not-allowed; }

                /* Modules Grid */
                .modules-grid-main { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 24px; }
                .main-module-card { display: flex; align-items: center; gap: 16px; padding: 18px 20px; background: white; border: 1px solid #e2e8f0; border-radius: 18px; cursor: pointer; transition: all 0.25s cubic-bezier(0.2,0.8,0.2,1); position: relative; overflow: hidden; }
                .main-module-card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); border-color: #cbd5e1; }
                .main-module-card.enabled { border-color: #c7d2fe; background: #fdfeff; box-shadow: 0 4px 15px -3px rgba(99,102,241,0.1); }
                .main-module-card.enabled:hover { box-shadow: 0 10px 30px -5px rgba(99,102,241,0.15); border-color: #818cf8; }
                .main-module-card.locked { opacity: 0.7; cursor: default; background: #f8fafc; border-color: #f1f5f9; }
                .main-module-card.locked:hover { transform: none; box-shadow: none; }

                .main-module-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #94a3b8; background: #f1f5f9; transition: all 0.3s; flex-shrink: 0; }
                .main-module-card.enabled .main-module-icon { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); color: #6366f1; }

                /* Logistics Section Extra Styles */
                .logistics-section-wrapper { margin: 32px 24px 24px; background: white; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .logistics-header-bar { padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .logistics-header-bar h3 { font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; }
                .logistics-content-area { padding: 24px; }
                .logi-parent { margin-bottom: 20px; border-width: 2px; }
                .logistics-children-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding-left: 16px; border-left: 2px dashed #cbd5e1; margin-left: 22px; }
                .child-card { padding: 12px 16px; border-radius: 14px; box-shadow: none; border-color: #f1f5f9; }
                .child-card .main-module-icon { width: 32px; height: 32px; border-radius: 8px; }

                .main-module-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
                .main-module-name { font-weight: 700; font-size: 0.95rem; color: #1e293b; }
                .main-module-status { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
                .main-module-card.enabled .main-module-status { color: #6366f1; }

                .main-module-action { flex-shrink: 0; }
                .lock-icon { color: #cbd5e1; }

                .lock-badge { display: flex; align-items: center; gap: 6px; background: #f1f3ed; color: #58623f; font-size: 0.7rem; font-weight: 800; padding: 6px 14px; border-radius: 50px; border: 1px solid #e2e8d8; }
                .system-notice { display: flex; align-items: flex-start; gap: 14px; padding: 20px 28px; background: #f8faf5; border-bottom: 1px solid #e2e8d8; font-size: 0.85rem; color: #58623f; line-height: 1.6; }

                .save-bar { position: sticky; bottom: 0; padding: 20px 24px; border-top: 1px solid #f1f3ed; display: flex; justify-content: flex-end; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); z-index: 50; margin-top: auto; border-radius: 0 0 24px 24px; }
                .btn-save { display: flex; align-items: center; gap: 10px; padding: 12px 32px; background: #005d31; border: none; border-radius: 14px; color: white; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,93,49,0.2); width: auto; }
                .btn-save:hover { background: #004d29; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,77,41,0.3); }
                .btn-save:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
                .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
                .empty-icon { width: 96px; height: 96px; background: #f1f5f9; border-radius: 28px; display: flex; align-items: center; justify-content: center; color: #cbd5e1; margin-bottom: 24px; }
                .empty-state h3 { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
                .empty-state p { font-size: 0.95rem; color: #64748b; max-width: 320px; line-height: 1.6; margin: 0; }

                /* Modals */
                .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 20px; animation: fadeIn 0.2s ease-out; }
                .modal-box { background: white; border-radius: 28px; width: 100%; max-width: 520px; box-shadow: 0 25px 60px -12px rgba(0,0,0,0.25); animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); overflow: hidden; max-height: calc(100vh - 40px); display: flex; flex-direction: column; }
                .modal-box.small { max-width: 400px; }

                .modal-header-fancy { display: flex; align-items: flex-start; gap: 18px; padding: 32px 32px 24px; background: linear-gradient(135deg, #f8faff, #eef2ff); border-bottom: 1px solid #e0e7ff; position: relative; }
                .modal-header-fancy h3 { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; }
                .modal-header-sub { font-size: 0.85rem; color: #64748b; margin: 6px 0 0; font-weight: 500; }
                .modal-header-icon { width: 52px; height: 52px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; box-shadow: 0 8px 16px -4px rgba(99,102,241,0.3); }

                .modal-close { position: absolute; top: 20px; right: 20px; background: white; border: 1px solid #e2e8f0; color: #94a3b8; cursor: pointer; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 12px; transition: all 0.2s; }
                .modal-close:hover { background: #fee2e2; color: #ef4444; border-color: #fca5a5; transform: rotate(90deg); }
                .modal-body { padding: 32px; overflow-y: auto; flex: 1; }
                .text-center { text-align: center; }
                .modal-footer { padding: 24px 32px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px; background: #f8fafc; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .field { margin-bottom: 24px; }
                .field:last-child { margin-bottom: 0; }
                .field label { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 800; color: #475569; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
                .field label svg { color: #94a3b8; }
                .required { color: #ef4444; }
                .field input[type="text"], .field input[type="number"] { width: 100%; padding: 14px 18px; border: 2px solid #e2e8d8; border-radius: 16px; font-size: 0.95rem; color: #003019; outline: none; transition: all 0.2s; box-sizing: border-box; background: #f8faf5; font-family: inherit; }
                .field input:focus { border-color: #005d31; background: white; box-shadow: 0 0 0 4px rgba(0,93,49,0.1); }
                .field input::placeholder { color: #c5cdba; }

                .desc-textarea { width: 100%; padding: 14px 18px; border: 2px solid #e2e8d8; border-radius: 16px; font-size: 0.9rem; color: #003019; outline: none; transition: all 0.2s; box-sizing: border-box; background: #f8faf5; font-family: inherit; resize: vertical; min-height: 60px; line-height: 1.5; }
                .desc-textarea:focus { border-color: #005d31; background: white; box-shadow: 0 0 0 4px rgba(0,93,49,0.1); }
                .desc-textarea::placeholder { color: #c5cdba; }

                .desc-edit-section { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
                .desc-edit-label { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 800; color: #475569; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
                .desc-edit-label svg { color: #94a3b8; }

                .modules-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
                .modules-label-row label { margin-bottom: 0; }
                .modules-counter { font-size: 0.75rem; font-weight: 800; padding: 4px 12px; border-radius: 50px; background: #f1f5f9; color: #94a3b8; transition: all 0.3s; }
                .modules-counter.has-selected { background: #e0e7ff; color: #6366f1; }

                .toggle-list { display: flex; flex-direction: column; gap: 8px; }
                .toggle-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #fff; border: 2px solid #f1f5f9; border-radius: 16px; cursor: pointer; transition: all 0.2s; user-select: none; }
                .toggle-item:hover { border-color: #cbd5e1; transform: translateY(-1px); }
                .toggle-item.active { background: #f5f3ff; border-color: #c7d2fe; }
                .toggle-item.active:hover { border-color: #818cf8; }
                .toggle-info { display: flex; align-items: center; gap: 14px; }
                .toggle-dot { width: 24px; height: 24px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
                .toggle-dot.on { background: #6366f1; color: white; }
                .toggle-info span { font-size: 0.9rem; font-weight: 600; color: #334155; }
                .toggle-item.active .toggle-info span { color: #0f172a; }

                .toggle-switch { width: 44px; height: 24px; border-radius: 12px; background: #cbd5e1; position: relative; transition: all 0.25s; flex-shrink: 0; }
                .toggle-switch.on { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
                .toggle-thumb { width: 20px; height: 20px; border-radius: 50%; background: white; position: absolute; top: 2px; left: 2px; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
                .toggle-switch.on .toggle-thumb { left: 22px; }

                .btn-cancel { padding: 12px 24px; background: white; border: 2px solid #e2e8f0; border-radius: 14px; font-weight: 700; color: #64748b; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; font-family: inherit; }
                .btn-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
                .btn-confirm { display: flex; align-items: center; gap: 10px; padding: 12px 28px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 14px; font-weight: 700; color: white; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(99,102,241,0.3); font-family: inherit; }
                .btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99,102,241,0.4); }
                .btn-confirm:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
                .btn-danger { padding: 12px 28px; background: linear-gradient(135deg, #ef4444, #dc2626); border: none; border-radius: 14px; font-weight: 700; color: white; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(239,68,68,0.3); font-family: inherit; }
                .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(239,68,68,0.4); }

                .delete-icon { width: 72px; height: 72px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ef4444; margin: 0 auto 20px; }
                .loader-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-weight: 900; color: #6366f1; letter-spacing: 2px; }

                @media (max-width: 900px) {
                    .main-content { padding: 20px 16px 100px; }
                    .content-grid { grid-template-columns: 1fr; gap: 24px; }
                    .roles-panel { max-height: 400px; }
                    .roles-list { max-height: 350px; }
                    .modules-grid-main { grid-template-columns: 1fr; }
                    .save-bar { 
                        position: fixed; 
                        bottom: 0; 
                        left: 0; 
                        right: 0; 
                        border-radius: 0; 
                        padding: 16px 20px; 
                        background: white; 
                        box-shadow: 0 -10px 25px rgba(0,0,0,0.1); 
                        border-top: 1px solid #e2e8f0;
                        z-index: 1000;
                    }
                    .btn-save { width: 100%; justify-content: center; height: 52px; font-size: 1rem; }
                    .perms-panel { border-radius: 20px; margin-bottom: 20px; }
                }
            `}</style>
        </div>
    );
}
