'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarcodeRepository } from '@/lib/repositories/barcode.repository';
import { useAuth } from '@/hooks/useAuth';

import { useRouter } from 'next/navigation';

export default function HistorialPage() {
    const router = useRouter();
    const { user, userRole, isAdmin } = useAuth();
    const hasSolicitudesPermission = isAdmin || (user?.permiso_solicitudes === true);

    const [activeTab, setActiveTab] = useState<'productos' | 'cajas'>('productos');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [historialList, setHistorialList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistorial = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await BarcodeRepository.getHistory(activeTab);
            if (error) throw error;

            const mappedData = data.map((item: any) => {
                const isProd = activeTab === 'productos';
                const snapshot = isProd ? item.metadata_producto : item.metadata_caja;
                const master = isProd ? item.productos_barcode : item.cajas_barcode;

                // Priority: Snapshot > Master > ID/Barcode (fallback)
                const nombreVal = snapshot
                    ? (isProd ? snapshot.presentacion : snapshot.tipo_caja)
                    : (isProd ? master?.presentacion : master?.tipo_caja);

                const unitsVal = snapshot
                    ? (isProd ? snapshot.unidades : snapshot.capacidad_max)
                    : (isProd ? master?.unidades_por_caja : master?.capacidad_max);

                return {
                    id: item.id,
                    barcode: item.barcode,
                    lote: item.lote,
                    fecha: item.created_at,
                    nombre: nombreVal || 'Desconocido',
                    tipo: nombreVal || 'Desconocido',
                    operador: item.usuarios?.nombre_completo || 'Sistema',
                    edit_started_at: item.edit_started_at,
                    edit_expires_at: item.edit_expires_at,
                    // Reconstruct masterData from snapshot if available for the detail modal
                    masterData: snapshot ? {
                        ...master,
                        presentacion: snapshot.presentacion,
                        tipo_caja: snapshot.tipo_caja,
                        unidades_por_caja: snapshot.unidades,
                        capacidad_max: snapshot.capacidad_max,
                        vida_util: snapshot.vida_util,
                        registro_sanitario: snapshot.registro_sanitario
                    } : master,
                    hasSnapshot: !!snapshot
                };
            });

            setHistorialList(mappedData);
        } catch (error: any) {
            console.error("Error fetching historial full object:", error);
            const errorMsg = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            alert(`Error consultando historial: ${errorMsg}`);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchHistorial();
    }, [fetchHistorial]);

    const filteredList = historialList.filter(item => {
        const matchSearch = item.lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.barcode.includes(searchTerm) ||
            (item.nombre || item.tipo).toLowerCase().includes(searchTerm.toLowerCase());
        const matchDate = dateFilter ? item.fecha.startsWith(dateFilter) : true;
        return matchSearch && matchDate;
    });

    // === EDIT LOGIC & MODALS === //
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [editLoteValue, setEditLoteValue] = useState('');
    const [editLockInfo, setEditLockInfo] = useState<{ expiresAt: string, startedAt: string } | null>(null);
    const [timeLeft, setTimeLeft] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editPassword, setEditPassword] = useState('');

    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [pendingEditRecord, setPendingEditRecord] = useState<any>(null);

    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [requestMotivo, setRequestMotivo] = useState('');
    const [requestRecordId, setRequestRecordId] = useState<number | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);

    // Detail Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [viewingRecord, setViewingRecord] = useState<any>(null);

    // Audit History State
    const [editHistory, setEditHistory] = useState<any[]>([]);
    const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<any>(null);
    const [zoomImage, setZoomImage] = useState<{ url: string, description?: string } | null>(null);

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (editModalOpen && editLockInfo?.expiresAt) {
            interval = setInterval(() => {
                const now = new Date();
                const expires = new Date(editLockInfo.expiresAt);
                const diff = expires.getTime() - now.getTime();

                if (diff <= 0) {
                    setTimeLeft('Expirado');
                    clearInterval(interval);
                    alert("Su tiempo de edición ha expirado.");
                    handleCancelEdit();
                } else {
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [editModalOpen, editLockInfo]);

    const handleEditClick = (record: any) => {
        if (hasSolicitudesPermission) {
            setPendingEditRecord(record);
            setPasswordInput('');
            setPasswordModalOpen(true);
        } else {
            // Attempt lock without password (it will return canRequest if unauthorized)
            executeEditLock(record, '');
        }
    };

    const handlePasswordSubmit = () => {
        if (pendingEditRecord) {
            executeEditLock(pendingEditRecord, passwordInput);
            setPasswordModalOpen(false);
            setPendingEditRecord(null);
            setPasswordInput('');
        }
    };

    const executeEditLock = async (record: any, password: string) => {
        try {
            const res = await fetch('/api/escaner-codigos/historial/lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    historial_id: record.id,
                    scan_mode: activeTab,
                    password
                })
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.canRequest) {
                    setRequestRecordId(record.id);
                    setRequestMotivo('');
                    setRequestModalOpen(true);
                } else if (data.requirePassword) {
                    alert(data.error);
                } else {
                    alert(data.error || 'Error al iniciar edición');
                }
                return;
            }

            setEditLockInfo({ expiresAt: data.expiresAt, startedAt: data.startedAt });
            if (password) setEditPassword(password);

            // FETCH HISTORY IN PARALLEL
            const [histRes] = await Promise.all([
                fetch(`/api/escaner-codigos/historial/history?id=${record.id}&mode=${activeTab}`).then(r => r.ok ? r.json() : [])
            ]);

            setEditHistory(histRes);
            setEditingRecord(record);
            setEditLoteValue(record.lote);
            setEditModalOpen(true);

        } catch (err: any) {
            alert(err.message || 'Error de conexión');
        }
    };

    const handleRequestSubmit = async () => {
        if (!requestRecordId) return;
        setIsRequesting(true);
        try {
            const reqRes = await fetch('/api/escaner-codigos/historial/request-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    historial_id: requestRecordId,
                    scan_mode: activeTab,
                    motivo: requestMotivo
                })
            });
            const reqData = await reqRes.json();
            if (reqRes.ok) {
                alert('Solicitud enviada. Un administrador debe aprobarla antes de que puedas editar este lote.');
                setRequestModalOpen(false);
            } else {
                alert(reqData.error || 'Error al enviar solicitud');
            }
        } catch (error) {
            alert('Error de conexión al enviar la solicitud');
        } finally {
            setIsRequesting(false);
        }
    };

    const handleCancelEdit = async () => {
        if (editingRecord) {
            try {
                await fetch('/api/escaner-codigos/historial/unlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ historial_id: editingRecord.id, scan_mode: activeTab })
                });
            } catch (err) { }
        }
        setEditModalOpen(false);
        setEditingRecord(null);
        setEditLockInfo(null);
        setEditPassword('');
    };

    const handleSaveEdit = async () => {
        if (!editingRecord || !editLoteValue.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/escaner-codigos/historial/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    historial_id: editingRecord.id,
                    scan_mode: activeTab,
                    lote: editLoteValue.trim(),
                    password: editPassword
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert('Lote editado exitosamente');
            setEditModalOpen(false);
            setEditingRecord(null);
            fetchHistorial(); // Refetch Data
        } catch (err: any) {
            alert(err.message || 'Error guardando cambios');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:pl-[--sidebar-width] transition-all pb-24 text-[#1e293b]">
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-[#e2e8f0] pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2 cursor-pointer group" onClick={() => router.push('/escaner-codigos')}>
                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#64748b] group-hover:text-blue-500 transition-colors border border-[#e2e8f0]">
                                <i className="bi bi-arrow-left"></i>
                            </div>
                            <span className="text-[10px] text-[#94a3b8] group-hover:text-blue-500 font-black uppercase tracking-[0.2em] transition-colors">Menú Escaneo</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-[#1e293b] tracking-tighter uppercase m-0 leading-tight">Historial</h1>
                        <p className="text-[#64748b] text-sm font-medium mt-1">Historial completo de lecturas en planta.</p>
                    </div>

                    <div className="flex bg-[#f1f5f9] p-1.5 rounded-2xl w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('productos')}
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'productos' ? 'bg-white text-[#1e293b] shadow-sm' : 'text-[#64748b] hover:text-[#1e293b]'
                                }`}
                        >
                            Productos
                        </button>
                        <button
                            onClick={() => setActiveTab('cajas')}
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'cajas' ? 'bg-white text-[#1e293b] shadow-sm' : 'text-[#64748b] hover:text-[#1e293b]'
                                }`}
                        >
                            Cajas
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                        <input
                            type="text"
                            placeholder="Buscar por lote o código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[#cbd5e1] rounded-2xl pl-12 pr-6 py-4 text-[#1e293b] placeholder:text-[#cbd5e1] outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        />
                    </div>
                    <div className="relative">
                        <i className="bi bi-calendar3 absolute left-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full bg-white border border-[#cbd5e1] rounded-2xl pl-12 pr-6 py-4 text-[#1e293b] outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        />
                    </div>
                </div>

                {/* Status Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-[#94a3b8] font-bold uppercase tracking-widest px-2 gap-3 mb-2">
                    <span className="bg-white/50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">{filteredList.length} Resultados</span>
                    {dateFilter && (
                        <button
                            onClick={() => setDateFilter('')}
                            className="group flex items-center gap-2 bg-red-50/50 hover:bg-red-50 border border-red-100/50 hover:border-red-200 text-red-500 hover:text-red-600 px-4 py-1.5 rounded-xl transition-all duration-300 cursor-pointer shadow-sm"
                        >
                            <i className="bi bi-calendar-x text-sm group-hover:scale-110 transition-transform duration-300"></i>
                            <span className="font-medium text-[13px]">Borrar filtro de fecha</span>
                        </button>
                    )}
                </div>

                {/* Table/List Container */}
                <div className="bg-white border border-[#e2e8f0] rounded-[2.5rem] shadow-2xl overflow-hidden mb-12">
                    {/* Tabla/Listado */}
                    <div className="bg-[#ffffff] border border-[#cbd5e1] rounded-3xl overflow-hidden shadow-2xl relative">
                        {/* Items */}
                        <div className="divide-y divide-[#f1f5f9]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center p-20 gap-4">
                                    <div className={`w-12 h-12 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin`}></div>
                                    <p className="text-[#94a3b8] text-[10px] font-black uppercase tracking-widest">Cargando bitácora...</p>
                                </div>
                            ) : filteredList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                                        <i className="bi bi-inbox text-3xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-[#1e293b] font-bold text-lg mb-1 uppercase tracking-tight">Sin registros</h3>
                                        <p className="text-[#94a3b8] text-sm">Prueba ajustando los filtros de búsqueda.</p>
                                    </div>
                                </div>
                            ) : (
                                filteredList.map((item) => (
                                    <div key={item.id} className="flex flex-col md:grid md:grid-cols-[2fr_2fr_1.5fr_1fr] gap-4 p-5 sm:p-6 hover:bg-[#f8fafc] transition-colors items-center group">
                                        {/* Lote */}
                                        <div className="flex items-center gap-4 w-full min-w-0">
                                            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 border transition-all ${activeTab === 'productos'
                                                ? 'bg-green-50 text-[#208754] border-green-100 group-hover:bg-[#208754] group-hover:text-white'
                                                : 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-500 group-hover:text-white'
                                                }`}>
                                                <i className={`bi ${activeTab === 'productos' ? 'bi-shield-check' : 'bi-truck'}`}></i>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5 rounded border border-slate-700 uppercase tracking-widest">
                                                        {activeTab === 'productos' ? 'MAR' : 'FEB'}{String(item.id).padStart(4, '0')}
                                                    </span>
                                                    <h3 className="text-[#1e293b] font-black text-base sm:text-lg truncate m-0 leading-tight uppercase tracking-wider">{item.lote}</h3>
                                                    {item.hasSnapshot && (
                                                        <span className="bg-blue-50 text-blue-600 text-[8px] px-1.5 py-0.5 rounded-md font-black border border-blue-100 flex items-center gap-1" title="Datos Inmutables">
                                                            <i className="bi bi-shield-lock-fill"></i>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-mono font-bold text-[#94a3b8] uppercase tracking-widest line-clamp-1">
                                                    {item.nombre || item.tipo}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Fecha y Operador (Mobile friendly) */}
                                        <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-1 w-full">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#64748b]">
                                                <i className="bi bi-calendar3 text-slate-400"></i>
                                                {new Date(item.fecha).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#64748b]">
                                                <i className="bi bi-person-fill text-slate-400"></i>
                                                {item.operador.split(' ')[0]}
                                            </div>
                                        </div>

                                        {/* Código */}
                                        <div className="w-full md:w-auto">
                                            <span className="bg-slate-100 text-[#475569] px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold tracking-widest border border-slate-200">
                                                {item.barcode}
                                            </span>
                                        </div>

                                        {/* Acción */}
                                        <div className="flex items-center justify-end w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-[#f1f5f9] gap-2">
                                            <button
                                                onClick={() => { setViewingRecord(item); setDetailModalOpen(true); }}
                                                className="flex-1 md:flex-none h-11 px-6 md:px-0 md:w-11 rounded-xl bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all border border-blue-100 flex items-center justify-center shadow-sm gap-2"
                                                title="Ver Detalles"
                                            >
                                                <i className="bi bi-eye-fill text-lg"></i>
                                                <span className="md:hidden font-bold text-sm uppercase">Ver Detalles</span>
                                            </button>
                                            <button
                                                onClick={() => handleEditClick(item)}
                                                className="flex-1 md:flex-none h-11 px-6 md:px-0 md:w-11 rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all border border-orange-100 flex items-center justify-center shadow-sm gap-2"
                                                title="Editar Lote"
                                            >
                                                <i className="bi bi-pencil-square text-lg"></i>
                                                <span className="md:hidden font-bold text-sm uppercase">Editar Lote</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}

            {/* 1. Request Edit Modal */}
            {requestModalOpen && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setRequestModalOpen(false)}></div>
                    <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-black text-[#1e293b] mb-4 uppercase tracking-tighter">Solicitar Edición</h3>
                        <p className="text-[#64748b] text-sm mb-6">
                            No tienes permisos modificatorios nativos. Debes pedir que un superior apruebe tu modificación de este Lote.
                        </p>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">Motivo / Justificación</label>
                            <textarea
                                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-[#1e293b] focus:border-orange-500 outline-none transition-colors"
                                rows={4}
                                placeholder="Ej: Me equivoqué digitando el lote..."
                                value={requestMotivo}
                                onChange={e => setRequestMotivo(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setRequestModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleRequestSubmit}
                                disabled={isRequesting || !requestMotivo.trim()}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg shadow-orange-500/30"
                            >
                                {isRequesting ? 'Enviando...' : 'Enviar Solicitud'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Password Modal */}
            {passwordModalOpen && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setPasswordModalOpen(false)}></div>
                    <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto text-xl">
                            <i className="bi bi-shield-lock-fill"></i>
                        </div>
                        <h3 className="text-xl font-black text-[#1e293b] mb-2 text-center uppercase tracking-tighter">Credenciales</h3>
                        <p className="text-[#64748b] text-sm mb-6 text-center">Por seguridad, ingrese su contraseña para poder editar este lote.</p>
                        <input
                            type="password"
                            placeholder="Tu contraseña..."
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' ? handlePasswordSubmit() : null}
                            className="w-full text-center tracking-widest bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-[#1e293b] focus:border-red-500 outline-none transition-colors mb-6"
                        />
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setPasswordModalOpen(false)} className="w-full px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handlePasswordSubmit} className="w-full px-5 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30">
                                Desbloquear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Editing Modal */}
            {editModalOpen && editingRecord && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md"></div>
                    <div className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col max-h-[90vh] w-full max-w-2xl" style={{ zIndex: 10 }}>

                        <div className="p-5 sm:p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                    <i className="bi bi-pencil-square"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Modificar Lote</h3>
                                    <p className="text-[#64748b] text-xs font-bold uppercase tracking-widest mt-1 m-0">
                                        Tiempo Restante: <span className={timeLeft === 'Expirado' ? 'text-red-500' : 'text-red-500 animate-pulse'}>{timeLeft}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleCancelEdit} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors border-0">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 overflow-y-auto flex-grow custom-scrollbar space-y-6">
                            {/* Record Info & Tech Specs */}
                            <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] shadow-sm space-y-4">
                                <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${activeTab === 'productos' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <i className={`bi ${activeTab === 'productos' ? 'bi-box-seam' : 'bi-truck'}`}></i>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-none mb-1">Caja / Presentación</span>
                                        <span className="text-[#1e293b] font-black text-lg">{editingRecord.nombre || editingRecord.tipo}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="col-span-2 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                        <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Código de Barras Maestro</span>
                                        <div className="flex items-center gap-2 text-[#1e293b] font-mono font-bold text-xs tracking-widest">
                                            <i className="bi bi-upc-scan text-slate-400"></i>
                                            {editingRecord.barcode}
                                        </div>
                                    </div>
                                    {activeTab === 'productos' ? (
                                        <>
                                            <div className="bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                                <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Vida Útil</span>
                                                <div className="flex items-center gap-2 text-[#1e293b] font-bold text-xs">
                                                    <i className="bi bi-calendar-check text-green-500"></i>
                                                    {editingRecord.masterData?.vida_util || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                                <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Reg. Sanitario</span>
                                                <div className="flex items-center gap-2 text-[#1e293b] font-bold text-xs">
                                                    <i className="bi bi-shield-check text-blue-500"></i>
                                                    {editingRecord.masterData?.registro_sanitario || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="col-span-2 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                                <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Unidades por Caja</span>
                                                <div className="flex items-center gap-2 text-[#1e293b] font-bold text-xs">
                                                    <i className="bi bi-layers text-slate-400"></i>
                                                    {editingRecord.masterData?.unidades_por_caja} Unidades
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                            <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Capacidad Máxima</span>
                                            <div className="flex items-center gap-2 text-[#1e293b] font-bold text-xs">
                                                <i className="bi bi-plus-circle text-amber-500"></i>
                                                {editingRecord.masterData?.capacidad_max} Unidades
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Edit Input */}
                            <div className="bg-white p-5 rounded-2xl border border-orange-200 shadow-sm border-l-4 border-l-orange-500">
                                <label className="block text-xs font-bold text-[#1e293b] uppercase tracking-widest mb-3">Nuevo Lote Interno:</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={editLoteValue}
                                        onChange={e => setEditLoteValue(e.target.value.toUpperCase())}
                                        className="w-full bg-[#f8fafc] border-2 border-[#cbd5e1] focus:border-orange-500 rounded-xl p-4 text-2xl font-black text-[#1e293b] text-center tracking-[0.2em] outline-none transition-all uppercase shadow-inner"
                                        placeholder="EJ: LOTE-ABC-123"
                                        autoFocus
                                    />
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg">
                                        <i className="bi bi-alphabet-uppercase text-[10px]"></i>
                                    </div>
                                </div>
                            </div>

                            {/* Audit History Timeline */}
                            <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
                                <div className="bg-slate-50 px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-2">
                                    <i className="bi bi-clock-history text-slate-400"></i>
                                    <span className="text-xs font-bold text-[#475569] uppercase tracking-widest">Historial de Ediciones</span>
                                </div>
                                <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs text-[#64748b]">
                                        <thead className="sticky top-0 bg-[#f8fafc] border-b border-[#e2e8f0]">
                                            <tr>
                                                <th className="px-4 py-2 font-bold whitespace-nowrap">Fecha</th>
                                                <th className="px-4 py-2 font-bold whitespace-nowrap">Usuario</th>
                                                <th className="px-4 py-2 font-bold text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#f1f5f9]">
                                            {editHistory.length > 0 ? editHistory.map((hist: any) => (
                                                <tr key={hist.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap font-medium">{new Date(hist.created_at).toLocaleString('es-PE')}</td>
                                                    <td className="px-4 py-3 font-bold text-[#1e293b]">{hist.usuarios?.nombre_completo || 'Usuario'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => setSelectedHistoryDetail(hist)}
                                                            className="text-orange-500 hover:text-white hover:bg-orange-500 border border-orange-500/20 bg-orange-50 px-3 py-1 rounded-lg text-[10px] font-black transition-all uppercase tracking-tighter"
                                                        >
                                                            Detalles
                                                        </button>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-[#94a3b8] italic">No hay ediciones previas para este lote.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0 rounded-b-3xl">
                            <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0"
                            >
                                Descartar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSaving || !editLoteValue.trim() || editLoteValue === editingRecord.lote}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 border-0"
                            >
                                {isSaving ? 'Guardando...' : <><i className="bi bi-check-circle-fill"></i> Guardar Cambios</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing History Detail Mini-Modal */}
            {selectedHistoryDetail && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md"></div>
                    <div className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-lg" style={{ zIndex: 10 }}>
                        <div className="p-5 sm:p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                    <i className="bi bi-clock-history"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Detalles de Edición</h3>
                                    <p className="text-[#64748b] text-[10px] font-bold uppercase tracking-widest mt-1 m-0">Auditoría Técnica del Registro</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedHistoryDetail(null)} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors border-0">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="p-5 sm:p-6 space-y-5">
                            <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-orange-50 text-orange-500 border border-orange-100">
                                        <i className="bi bi-person-fill"></i>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-none">Responsable</div>
                                        <div className="font-bold text-[#1e293b] mt-1">{selectedHistoryDetail.usuarios?.nombre_completo || 'Usuario'}</div>
                                    </div>
                                </div>
                                <div className="text-right border-l border-[#e2e8f0] pl-4">
                                    <div className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-none">Fecha</div>
                                    <div className="text-xs font-bold text-[#1e293b] mt-1">{new Date(selectedHistoryDetail.created_at).toLocaleString('es-PE')}</div>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm">
                                <h6 className="font-black text-[10px] text-[#94a3b8] uppercase tracking-widest mb-4">Cambios Realizados</h6>
                                <div className="border border-[#e2e8f0] rounded-xl overflow-hidden text-xs">
                                    <div className="grid grid-cols-2 divide-x divide-[#e2e8f0]">
                                        <div className="p-4 bg-red-50/30">
                                            <span className="block text-[10px] uppercase font-black text-red-400 mb-1">Valor Anterior</span>
                                            <span className="font-black text-red-600 line-through decoration-red-400/50 break-all">{selectedHistoryDetail.changes?.before?.lote || '-'}</span>
                                        </div>
                                        <div className="p-4 bg-green-50/30">
                                            <span className="block text-[10px] uppercase font-black text-green-400 mb-1">Valor Nuevo</span>
                                            <span className="font-black text-green-700 break-all">{selectedHistoryDetail.changes?.after?.lote || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end rounded-b-3xl">
                            <button onClick={() => setSelectedHistoryDetail(null)} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#1e293b] text-white hover:bg-[#334155] transition-colors border-0">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Product Detail Modal */}
            {detailModalOpen && viewingRecord && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md" onClick={() => setDetailModalOpen(false)}></div>
                    <div className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-lg" style={{ zIndex: 10 }}>
                        <div className="p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 ${activeTab === 'productos' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                    <i className={`bi ${activeTab === 'productos' ? 'bi-box-seam' : 'bi-truck'}`}></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Detalles Técnicos</h3>
                                    <p className="text-[#64748b] text-[10px] font-bold uppercase tracking-widest mt-1 m-0">Información Maestra del {activeTab === 'productos' ? 'Producto' : 'Empaque'}</p>
                                </div>
                            </div>
                            <button onClick={() => setDetailModalOpen(false)} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors border-0">
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Product Header */}
                            <div className="text-center pb-2">
                                <div className="mb-2 flex flex-col items-center gap-2">
                                    <span className="text-[10px] font-black bg-slate-800 text-white px-3 py-1 rounded-lg uppercase tracking-[0.2em] shadow-sm">
                                        ID Historial: {activeTab === 'productos' ? 'MAR' : 'FEB'}{String(viewingRecord.id).padStart(4, '0')}
                                    </span>
                                    {viewingRecord.hasSnapshot && (
                                        <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest flex items-center gap-1">
                                            <i className="bi bi-camera-fill"></i> Snapshot Histórico
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-2xl font-black text-[#1e293b] uppercase tracking-tight mb-1">{viewingRecord.nombre || viewingRecord.tipo}</h2>
                                <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                    <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Lote:</span>
                                    <span className="text-xs font-black text-[#1e293b] uppercase tracking-wider">{viewingRecord.lote}</span>
                                </div>
                            </div>

                            {/* Tech Specs Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm col-span-2">
                                    <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Código de Barras</span>
                                    <div className="flex items-center gap-2 text-[#1e293b] font-mono font-bold tracking-widest">
                                        <i className="bi bi-upc-scan text-slate-400"></i>
                                        {viewingRecord.barcode}
                                    </div>
                                </div>
                                {activeTab === 'productos' ? (
                                    <>
                                        <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm">
                                            <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Vida Útil</span>
                                            <div className="flex items-center gap-2 text-[#1e293b] font-black">
                                                <i className="bi bi-calendar-check text-green-500"></i>
                                                {viewingRecord.masterData?.vida_util || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm">
                                            <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Reg. Sanitario</span>
                                            <div className="flex items-center gap-2 text-[#1e293b] font-black">
                                                <i className="bi bi-shield-check text-blue-500"></i>
                                                {viewingRecord.masterData?.registro_sanitario || 'N/A'}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm col-span-2">
                                            <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Configuración Empaque</span>
                                            <div className="flex items-center gap-2 text-[#1e293b] font-black text-sm">
                                                <i className="bi bi-layers text-slate-400"></i>
                                                {viewingRecord.masterData?.unidades_por_caja} Unid. por caja
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm col-span-2">
                                            <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Capacidad Máxima</span>
                                            <div className="flex items-center gap-2 text-[#1e293b] font-black">
                                                <i className="bi bi-plus-circle text-amber-500"></i>
                                                {viewingRecord.masterData?.capacidad_max} Unidades
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Scan Info */}
                            <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Operador</span>
                                        <span className="text-xs font-bold text-[#475569]">{viewingRecord.operador}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1">Escaneado el</span>
                                        <span className="text-xs font-bold text-[#475569]">{new Date(viewingRecord.fecha).toLocaleString('es-PE')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-white border-t border-[#e2e8f0] flex justify-end rounded-b-3xl">
                            <button onClick={() => setDetailModalOpen(false)} className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm bg-[#1e293b] text-white hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 border-0">
                                Cerrar Vista
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Zoom Image Logic (Full consistency) */}
            {zoomImage && (
                <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl transition-all animate-in fade-in" onClick={() => setZoomImage(null)}>
                    <div className="absolute top-6 right-6 flex gap-4">
                        <button className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all border-0 backdrop-blur-md">
                            <i className="bi bi-x-lg text-xl"></i>
                        </button>
                    </div>
                    <img src={zoomImage.url} alt="Zoom" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" />
                    {zoomImage.description && (
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-2xl font-bold border border-white/20 shadow-2xl text-center">
                            {zoomImage.description}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
