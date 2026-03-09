'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeRepository, BarcodeBox } from '@/lib/repositories/barcode.repository';

export default function CajasMasterPage() {
    const router = useRouter();
    const [cajas, setCajas] = useState<BarcodeBox[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // UI Local States for Modal
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingCaja, setEditingCaja] = useState<BarcodeBox | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        barcode: '',
        tipo_caja: '',
        capacidad_max: '0'
    });

    const fetchCajas = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await BarcodeRepository.getAllCajas();
            if (error) throw error;
            setCajas(data || []);
        } catch (err) {
            console.error("Error fetching cajas:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCajas();
    }, []);

    const openCreateModal = () => {
        setEditingCaja(null);
        setFormData({
            barcode: '',
            tipo_caja: '',
            capacidad_max: '0'
        });
        setShowModal(true);
    };

    const openEditModal = (caja: BarcodeBox) => {
        setEditingCaja(caja);
        setFormData({
            barcode: caja.barcode,
            tipo_caja: caja.tipo_caja,
            capacidad_max: String(caja.capacidad_max)
        });
        setShowModal(true);
    };

    const handleDelete = async (barcode: string) => {
        if (!confirm('¿Estás seguro de eliminar este tipo de caja?')) return;

        try {
            const { error } = await BarcodeRepository.deleteCaja(barcode);
            if (error) throw error;
            fetchCajas();
        } catch (err) {
            console.error("Error deleting caja:", err);
            alert("Error al eliminar la caja.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = {
            barcode: formData.barcode,
            tipo_caja: formData.tipo_caja,
            capacidad_max: parseInt(formData.capacidad_max) || 0
        };

        try {
            let error;
            if (editingCaja) {
                ({ error } = await BarcodeRepository.updateCaja(editingCaja.barcode, payload));
            } else {
                ({ error } = await BarcodeRepository.registerCaja(payload));
            }

            if (error) throw error;

            setShowModal(false);
            fetchCajas();
        } catch (err) {
            console.error("Error saving caja:", err);
            alert("Error al guardar la caja.");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCajas = cajas.filter(c =>
        c.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tipo_caja.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCajas.length / itemsPerPage);
    const paginatedCajas = filteredCajas.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:pl-[--sidebar-width] transition-all pb-24">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2" onClick={() => router.push('/escaneo')}>
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors">
                                <i className="bi bi-arrow-left"></i>
                            </div>
                            <span className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em]">Escaneo / Cajas</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Cajas de Escaneo</h1>
                        <p className="text-slate-400 font-medium">Gestión de tipos de empaque y capacidades máximas.</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-3 shrink-0"
                    >
                        <i className="bi bi-plus-circle-fill text-lg"></i>
                        Nuevo Tipo
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input
                            type="text"
                            placeholder="Buscar por código o tipo de caja..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* List Container */}
                <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden pb-4">
                    {/* Header Row */}
                    <div className="hidden md:grid grid-cols-[3fr_2fr_1fr] gap-4 p-6 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/50">
                        <div className="pl-4">Caja / Empaque</div>
                        <div>Parámetros</div>
                        <div className="flex justify-end pr-8">Acciones</div>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-white/5">
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-slate-900 animate-pulse m-4 rounded-2xl"></div>)
                        ) : paginatedCajas.length === 0 ? (
                            <div className="py-20 text-center space-y-4">
                                <i className="bi bi-box text-4xl text-slate-700"></i>
                                <div>
                                    <h3 className="text-white font-bold text-lg">No hay cajas encontradas</h3>
                                </div>
                            </div>
                        ) : (
                            paginatedCajas.map(caja => (
                                <div key={caja.barcode} className="grid grid-cols-1 md:grid-cols-[3fr_2fr_1fr] gap-4 p-6 hover:bg-white/[0.02] transition-colors items-center group">
                                    {/* Info */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xl shrink-0 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                            {caja.tipo_caja.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-white font-bold text-base md:text-lg truncate">{caja.tipo_caja}</h3>
                                            <p className="text-xs font-mono text-slate-500 mt-0.5">ID: {caja.barcode}</p>
                                        </div>
                                    </div>

                                    {/* Parámetros */}
                                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-950 border border-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider w-fit whitespace-nowrap">
                                            Capacidad: {caja.capacidad_max} Ud.
                                        </span>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-start md:justify-end gap-2 md:pr-4">
                                        <button onClick={() => openEditModal(caja)} className="w-10 h-10 rounded-xl bg-slate-950 border border-white/5 text-slate-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/20 transition-all flex items-center justify-center">
                                            <i className="bi bi-pencil-fill"></i>
                                        </button>
                                        <button onClick={() => handleDelete(caja.barcode)} className="w-10 h-10 rounded-xl bg-slate-950 border border-white/5 text-slate-400 hover:text-white hover:border-red-500/50 hover:bg-red-500/20 transition-all flex items-center justify-center">
                                            <i className="bi bi-trash3-fill"></i>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination */}
                    {!isLoading && totalPages > 0 && (
                        <div className="px-6 pt-6 mt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <span className="text-sm font-medium text-slate-500">
                                Mostrando <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredCajas.length)}</span> de <span className="text-white">{filteredCajas.length}</span>
                            </span>

                            <div className="flex gap-1.5 flex-wrap justify-center">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 hover:bg-white/5 text-slate-400 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <i className="bi bi-chevron-left"></i>
                                </button>

                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-colors shrink-0 ${currentPage === i + 1
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border-transparent'
                                                : 'border border-white/10 text-slate-400 hover:bg-white/5'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 hover:bg-white/5 text-slate-400 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <i className="bi bi-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <form onSubmit={handleSubmit} className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-200">

                        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"></div>

                        <header className="mb-8 relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                {editingCaja ? 'Editar Caja' : 'Nueva Caja'}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">Configure los parámetros del empaque.</p>
                        </header>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Código de Caja (ID Único)</label>
                                <div className="relative">
                                    <input
                                        required
                                        disabled={!!editingCaja}
                                        value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-mono disabled:opacity-50"
                                        placeholder="CAJA-001..."
                                    />
                                    <i className="bi bi-qr-code absolute right-5 top-1/2 -translate-y-1/2 text-slate-700"></i>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Nombre / Tipo de Caja</label>
                                <input
                                    required
                                    value={formData.tipo_caja}
                                    onChange={(e) => setFormData({ ...formData, tipo_caja: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-medium"
                                    placeholder="Ej: Caja Master Corrugada 12x1L"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Capacidad Máxima (Unidades)</label>
                                <input
                                    type="number"
                                    value={formData.capacidad_max}
                                    onChange={(e) => setFormData({ ...formData, capacidad_max: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-bold"
                                />
                            </div>
                        </div>

                        <div className="mt-10 flex gap-4">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-5 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest"
                            >
                                CANCELAR
                            </button>
                            <button
                                disabled={isSaving}
                                type="submit"
                                className="flex-[1.5] bg-blue-600 hover:bg-blue-500 text-white py-5 px-10 rounded-2xl font-black transition-all text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20"
                            >
                                {isSaving ? 'GUARDANDO...' : editingCaja ? 'ACTUALIZAR' : 'REGISTRAR'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
