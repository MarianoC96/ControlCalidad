'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeRepository, BarcodeBox } from '@/lib/repositories/barcode.repository';
import { formatBarcode } from '@/lib/utils';

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
        capacidad_max: '0',
        imagen_url: ''
    });

    // Image upload states
    const [imageMode, setImageMode] = useState<'file' | 'url'>('file');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            capacidad_max: '0',
            imagen_url: ''
        });
        setImagePreview(null);
        setImageMode('file');
        setShowModal(true);
    };

    const openEditModal = (caja: BarcodeBox) => {
        setEditingCaja(caja);
        setFormData({
            barcode: caja.barcode,
            tipo_caja: caja.tipo_caja,
            capacidad_max: String(caja.capacidad_max),
            imagen_url: caja.imagen_url || ''
        });
        setImagePreview(caja.imagen_url || null);
        setImageMode(caja.imagen_url?.startsWith('data:') ? 'file' : 'url');
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
            barcode: formatBarcode(formData.barcode, 'caja'),
            tipo_caja: formData.tipo_caja,
            capacidad_max: parseInt(formData.capacidad_max) || 0,
            imagen_url: formData.imagen_url || undefined
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
        } catch (err: any) {
            console.error("Error saving caja full object:", err);
            const errorMsg = err.message || err.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            alert(`Error al guardar la caja: ${errorMsg}`);
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
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:pl-[--sidebar-width] transition-all pb-24">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-[#e2e8f0] pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2 cursor-pointer group" onClick={() => router.push('/escaner-codigos')}>
                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#64748b] group-hover:text-[#969836] transition-colors border border-[#e2e8f0]">
                                <i className="bi bi-arrow-left"></i>
                            </div>
                            <span className="text-[10px] text-[#94a3b8] group-hover:text-[#969836] font-black uppercase tracking-[0.2em] transition-colors">Menú Escaneo</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-[#1e293b] tracking-tighter uppercase m-0 leading-tight">Cajas</h1>
                        <p className="text-[#64748b] text-sm font-medium mt-1">Gestión de envases y capacidades.</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="w-full sm:w-auto bg-[#969836] hover:bg-[#7b7c2b] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#969836]/20 active:scale-95 flex items-center justify-center gap-3 shrink-0 cursor-pointer"
                    >
                        <i className="bi bi-plus-circle-fill text-lg"></i>
                        Nuevo Tipo
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                        <input
                            type="text"
                            placeholder="Buscar por código o tipo de caja..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-2xl pl-12 pr-6 py-4 text-[#1e293b] placeholder:text-[#cbd5e1] outline-none focus:border-[#969836]/50 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* List Container */}
                <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-[2.5rem] shadow-2xl overflow-hidden pb-4">
                    {/* Header Row */}
                    <div className="hidden md:grid grid-cols-[3fr_2fr_1fr] gap-4 p-6 border-b border-[#e2e8f0] text-[10px] font-black uppercase tracking-widest text-[#94a3b8] bg-[#ffffff]/80">
                        <div className="pl-4">Caja / Empaque</div>
                        <div>Parámetros</div>
                        <div className="flex justify-end pr-8">Acciones</div>
                    </div>
                    {/* Items */}
                    <div className="divide-y divide-[#f1f5f9]">
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-[#ffffff] animate-pulse m-4 rounded-2xl"></div>)
                        ) : paginatedCajas.length === 0 ? (
                            <div className="py-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                                    <i className="bi bi-box text-3xl"></i>
                                </div>
                                <h3 className="text-[#1e293b] font-bold text-lg uppercase tracking-tight">Sin resultados</h3>
                            </div>
                        ) : (
                            paginatedCajas.map(caja => (
                                <div key={caja.barcode} className="flex flex-col md:grid md:grid-cols-[3fr_2fr_1fr] gap-4 p-5 sm:p-6 hover:bg-[#f8fafc] transition-colors items-center group">
                                    {/* Info */}
                                    <div className="flex items-center gap-4 w-full min-w-0">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#b5b74b]/10 text-[#b5b74b] flex items-center justify-center font-black text-xl shrink-0 border border-[#b5b74b]/20 group-hover:bg-[#b5b74b] group-hover:text-white transition-all shadow-sm">
                                            {caja.tipo_caja.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-[#1e293b] font-black text-base sm:text-lg truncate m-0 leading-tight">{caja.tipo_caja}</h3>
                                            <p className="text-[10px] font-mono font-bold text-[#94a3b8] mt-1 uppercase tracking-widest">{caja.barcode}</p>
                                        </div>
                                    </div>

                                    {/* Parámetros */}
                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                        <div className="bg-[#f1f5f9] text-[#475569] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 border border-[#e2e8f0]">
                                            <i className="bi bi-box-fill text-slate-400"></i>
                                            Capacidad: {caja.capacidad_max} Uds
                                        </div>
                                        <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 border border-blue-100 sm:flex hidden">
                                            <i className="bi bi-check-circle-fill text-blue-300"></i>
                                            Validado
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-end gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-[#f1f5f9]">
                                        <button
                                            onClick={() => openEditModal(caja)}
                                            className="flex-1 md:flex-none h-11 w-11 rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all border border-orange-100 flex items-center justify-center shadow-sm cursor-pointer"
                                            title="Editar"
                                        >
                                            <i className="bi bi-pencil-square text-lg"></i>
                                            <span className="md:hidden ml-2 font-bold text-sm">Editar</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(caja.barcode)}
                                            className="flex-1 md:flex-none h-11 w-11 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-100 flex items-center justify-center shadow-sm cursor-pointer"
                                            title="Eliminar"
                                        >
                                            <i className="bi bi-trash3 text-lg"></i>
                                            <span className="md:hidden ml-2 font-bold text-sm">Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination */}
                    {!isLoading && totalPages > 0 && (
                        <div className="px-6 pt-6 mt-2 border-t border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-4">
                            <span className="text-sm font-medium text-[#94a3b8]">
                                Mostrando <span className="text-[#1e293b]">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredCajas.length)}</span> de <span className="text-[#1e293b]">{filteredCajas.length}</span>
                            </span>

                            <div className="flex gap-1.5 flex-wrap justify-center">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#cbd5e1] hover:bg-white/5 text-[#64748b] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <i className="bi bi-chevron-left"></i>
                                </button>

                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-colors shrink-0 ${currentPage === i + 1
                                            ? 'bg-[#7b7c2b] text-white shadow-lg shadow-blue-600/20 border-transparent'
                                            : 'border border-[#cbd5e1] text-[#64748b] hover:bg-white/5'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#cbd5e1] hover:bg-white/5 text-[#64748b] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
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
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <form onSubmit={handleSubmit} className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-xl max-h-[90vh]" style={{ zIndex: 10 }}>
                        <div className="p-5 sm:p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-3xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#b5b74b]/10 text-[#b5b74b] rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                    <i className="bi bi-box2"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0 flex items-center gap-2">
                                        {editingCaja ? 'Editar Caja' : 'Nueva Caja'}
                                    </h3>
                                    <p className="text-[#64748b] text-sm mt-1 mb-0">Configure los parámetros del empaque.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] flex items-center justify-center text-[#1e293b] transition-transform active:scale-90 border-0 shadow-sm">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="space-y-6 w-full">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Código de Caja (ID Único)</label>
                                    <div className="relative">
                                        <input
                                            required
                                            disabled={!!editingCaja}
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-mono disabled:opacity-50"
                                            placeholder="CAJA-001..."
                                        />
                                        <i className="bi bi-qr-code absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                                    </div>
                                    <p className="text-[10px] text-blue-600 font-bold mt-2 ml-1 flex items-center gap-2">
                                        <i className="bi bi-info-circle-fill"></i>
                                        Si no se completan los 14 dígitos, se añadirán ceros al inicio automáticamente.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Nombre / Tipo de Caja</label>
                                    <input
                                        required
                                        value={formData.tipo_caja}
                                        onChange={(e) => setFormData({ ...formData, tipo_caja: e.target.value })}
                                        className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-medium"
                                        placeholder="Ej: Caja Master Corrugada 12x1L"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Capacidad Máxima (Unidades)</label>
                                    <input
                                        type="number"
                                        value={formData.capacidad_max}
                                        onChange={(e) => setFormData({ ...formData, capacidad_max: e.target.value })}
                                        className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-bold"
                                    />
                                </div>

                                {/* Imagen de la Caja */}
                                <div className="space-y-3">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Imagen de la Caja</label>

                                    {/* Toggle entre archivo y URL */}
                                    <div className="flex bg-[#f1f5f9] rounded-xl p-1 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setImageMode('file')}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-0 flex items-center justify-center gap-2 ${imageMode === 'file' ? 'bg-white text-[#1e293b] shadow-sm' : 'bg-transparent text-[#94a3b8] hover:text-[#64748b]'}`}
                                        >
                                            <i className="bi bi-upload"></i>
                                            Subir Archivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setImageMode('url')}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-0 flex items-center justify-center gap-2 ${imageMode === 'url' ? 'bg-white text-[#1e293b] shadow-sm' : 'bg-transparent text-[#94a3b8] hover:text-[#64748b]'}`}
                                        >
                                            <i className="bi bi-link-45deg"></i>
                                            Pegar URL
                                        </button>
                                    </div>

                                    {imageMode === 'file' ? (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full border-2 border-dashed border-[#cbd5e1] hover:border-[#b5b74b] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-[#b5b74b]/5 group min-h-[120px]"
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        const base64 = event.target?.result as string;
                                                        setFormData({ ...formData, imagen_url: base64 });
                                                        setImagePreview(base64);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }}
                                            />
                                            {imagePreview && imageMode === 'file' ? (
                                                <div className="relative w-full flex justify-center">
                                                    <img src={imagePreview} alt="Preview" className="max-h-32 rounded-xl object-contain" />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setImagePreview(null);
                                                            setFormData({ ...formData, imagen_url: '' });
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                        }}
                                                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs border-2 border-white shadow-md hover:bg-red-600 transition-colors"
                                                    >
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-[#b5b74b]/10 flex items-center justify-center text-[#94a3b8] group-hover:text-[#b5b74b] transition-all">
                                                        <i className="bi bi-image text-xl"></i>
                                                    </div>
                                                    <span className="text-[10px] text-[#94a3b8] group-hover:text-[#b5b74b] font-bold uppercase tracking-widest transition-colors">Toca para seleccionar imagen</span>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <input
                                                    type="url"
                                                    value={formData.imagen_url.startsWith('data:') ? '' : formData.imagen_url}
                                                    onChange={(e) => {
                                                        const url = e.target.value;
                                                        setFormData({ ...formData, imagen_url: url });
                                                        setImagePreview(url || null);
                                                    }}
                                                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all text-sm"
                                                    placeholder="https://ejemplo.com/imagen.jpg"
                                                />
                                                <i className="bi bi-link-45deg absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                                            </div>
                                            {imagePreview && !imagePreview.startsWith('data:') && (
                                                <div className="flex justify-center p-3 bg-[#f8fafc] rounded-2xl border border-dashed border-slate-200">
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview URL"
                                                        className="max-h-32 rounded-xl object-contain"
                                                        onError={() => setImagePreview(null)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0 rounded-b-3xl">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0"
                            >
                                Cancelar
                            </button>
                            <button
                                disabled={isSaving}
                                type="submit"
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#7b7c2b] hover:bg-[#969836] text-white transition-all shadow-lg shadow-[#969836]/20 border-0 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : editingCaja ? 'Actualizar Caja' : 'Registrar Caja'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
