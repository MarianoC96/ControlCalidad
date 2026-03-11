'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeRepository, BarcodeProduct } from '@/lib/repositories/barcode.repository';

export default function ProductosMasterPage() {
    const router = useRouter();
    const [products, setProducts] = useState<BarcodeProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // UI Local States for Modal
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingProduct, setEditingProduct] = useState<BarcodeProduct | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        barcode: '',
        vida_util: '',
        registro_sanitario: '',
        presentacion: '',
        unidades_por_caja: '0'
    });

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await BarcodeRepository.getAllProducts();
            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            console.error("Error fetching products:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const openCreateModal = () => {
        setEditingProduct(null);
        setFormData({
            barcode: '',
            vida_util: '',
            registro_sanitario: '',
            presentacion: '',
            unidades_por_caja: '0'
        });
        setShowModal(true);
    };

    const openEditModal = (product: BarcodeProduct) => {
        setEditingProduct(product);
        setFormData({
            barcode: product.barcode,
            vida_util: product.vida_util || '',
            registro_sanitario: product.registro_sanitario || '',
            presentacion: product.presentacion,
            unidades_por_caja: String(product.unidades_por_caja)
        });
        setShowModal(true);
    };

    const handleDelete = async (barcode: string) => {
        if (!confirm('¿Estás seguro de eliminar este producto del maestro?')) return;

        try {
            const { error } = await BarcodeRepository.deleteProduct(barcode);
            if (error) throw error;
            fetchProducts();
        } catch (err) {
            console.error("Error deleting product:", err);
            alert("Error al eliminar el producto.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = {
            barcode: formData.barcode,
            vida_util: formData.vida_util,
            registro_sanitario: formData.registro_sanitario,
            presentacion: formData.presentacion,
            unidades_por_caja: parseInt(formData.unidades_por_caja) || 0
        };

        try {
            let error;
            if (editingProduct) {
                ({ error } = await BarcodeRepository.updateProduct(editingProduct.barcode, payload));
            } else {
                ({ error } = await BarcodeRepository.registerProduct(payload));
            }

            if (error) throw error;

            setShowModal(false);
            fetchProducts();
        } catch (err) {
            console.error("Error saving product:", err);
            alert("Error al guardar el producto.");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.presentacion.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:pl-[--sidebar-width] transition-all pb-24">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-[#e2e8f0] pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2 cursor-pointer group" onClick={() => router.push('/escaneo')}>
                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#64748b] group-hover:text-[#005d31] transition-colors border border-[#e2e8f0]">
                                <i className="bi bi-arrow-left"></i>
                            </div>
                            <span className="text-[10px] text-[#94a3b8] group-hover:text-[#005d31] font-black uppercase tracking-[0.2em] transition-colors">Menú Escaneo</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-[#1e293b] tracking-tighter uppercase m-0 leading-tight">Productos</h1>
                        <p className="text-[#64748b] text-sm font-medium mt-1">Catálogo de códigos y especificaciones.</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="w-full sm:w-auto bg-[#005d31] hover:bg-[#004d29] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#005d31]/20 active:scale-95 flex items-center justify-center gap-3 shrink-0"
                    >
                        <i className="bi bi-plus-circle-fill text-lg"></i>
                        Nuevo SKU
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                        <input
                            type="text"
                            placeholder="Buscar por código de barras o nombre del producto..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-2xl pl-12 pr-6 py-4 text-[#1e293b] placeholder:text-[#cbd5e1] outline-none focus:border-[#005d31]/50 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* List Container */}
                <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-[2.5rem] shadow-2xl overflow-hidden pb-4">
                    {/* Header Row */}
                    <div className="hidden md:grid grid-cols-[3fr_2fr_1fr] gap-4 p-6 border-b border-[#e2e8f0] text-[10px] font-black uppercase tracking-widest text-[#94a3b8] bg-[#ffffff]/80">
                        <div className="pl-4">Producto</div>
                        <div>Parámetros</div>
                        <div className="flex justify-end pr-8">Acciones</div>
                    </div>
                    {/* Items */}
                    <div className="divide-y divide-[#f1f5f9]">
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-[#ffffff] animate-pulse m-4 rounded-2xl"></div>)
                        ) : paginatedProducts.length === 0 ? (
                            <div className="py-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                                    <i className="bi bi-box-seam text-3xl"></i>
                                </div>
                                <div>
                                    <h3 className="text-[#1e293b] font-bold text-lg uppercase tracking-tight">Sin resultados</h3>
                                    <p className="text-[#94a3b8] text-sm">No se encontraron productos con ese criterio.</p>
                                </div>
                            </div>
                        ) : (
                            paginatedProducts.map(product => (
                                <div key={product.barcode} className="flex flex-col md:grid md:grid-cols-[3fr_2fr_1fr] gap-4 p-5 sm:p-6 hover:bg-[#f8fafc] transition-colors items-center group">
                                    {/* Producto info */}
                                    <div className="flex items-center gap-4 w-full min-w-0">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#208754]/10 text-[#208754] flex items-center justify-center font-black text-xl shrink-0 border border-[#208754]/20 group-hover:bg-[#208754] group-hover:text-white transition-all shadow-sm">
                                            {product.presentacion.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-[#1e293b] font-black text-base sm:text-lg truncate m-0 leading-tight">{product.presentacion}</h3>
                                            <p className="text-[10px] font-mono font-bold text-[#94a3b8] mt-1 uppercase tracking-widest">{product.barcode}</p>
                                        </div>
                                    </div>

                                    {/* Parámetros */}
                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                        <div className="bg-slate-100 text-[#475569] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-2">
                                            <i className="bi bi-calendar-check-fill text-slate-400"></i>
                                            {product.vida_util || 'N/A'}
                                        </div>
                                        <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 border border-blue-100">
                                            <i className="bi bi-box-fill text-blue-300"></i>
                                            {product.unidades_por_caja} Uds
                                        </div>
                                        <div className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 border border-green-100 sm:flex hidden">
                                            <i className="bi bi-shield-check text-green-300"></i>
                                            RS OK
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-end gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-[#f1f5f9]">
                                        <button
                                            onClick={() => openEditModal(product)}
                                            className="flex-1 md:flex-none h-11 w-11 rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all border border-orange-100 flex items-center justify-center shadow-sm"
                                            title="Editar"
                                        >
                                            <i className="bi bi-pencil-square text-lg"></i>
                                            <span className="md:hidden ml-2 font-bold text-sm">Editar</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.barcode)}
                                            className="flex-1 md:flex-none h-11 w-11 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-100 flex items-center justify-center shadow-sm"
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
                                Mostrando <span className="text-[#1e293b]">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> de <span className="text-[#1e293b]">{filteredProducts.length}</span>
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
                                            ? 'bg-[#004d29] text-white shadow-lg shadow-green-600/20 border-transparent'
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
                                <div className="w-12 h-12 bg-[#208754]/10 text-[#208754] rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                    <i className="bi bi-box-seam"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0 flex items-center gap-2">
                                        {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                    </h3>
                                    <p className="text-[#64748b] text-sm mt-1 mb-0">Configure los metadatos globales del SKU.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] flex items-center justify-center text-[#1e293b] transition-transform active:scale-90 border-0 shadow-sm">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            <div className="space-y-6 w-full">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Código de Barras (Universal)</label>
                                    <div className="relative">
                                        <input
                                            required
                                            disabled={!!editingProduct}
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-mono disabled:opacity-50"
                                            placeholder="775..."
                                        />
                                        <i className="bi bi-upc-scan absolute right-5 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Nombre / Presentación</label>
                                    <input
                                        required
                                        value={formData.presentacion}
                                        onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                                        className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all font-medium"
                                        placeholder="Ej: Aceituna Verde 200g"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Vida Útil</label>
                                        <input
                                            value={formData.vida_util}
                                            onChange={(e) => setFormData({ ...formData, vida_util: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all"
                                            placeholder="Ej: 12 meses"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Unidades / Caja</label>
                                        <input
                                            type="number"
                                            value={formData.unidades_por_caja}
                                            onChange={(e) => setFormData({ ...formData, unidades_por_caja: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Registro Sanitario</label>
                                    <input
                                        value={formData.registro_sanitario}
                                        onChange={(e) => setFormData({ ...formData, registro_sanitario: e.target.value })}
                                        className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl px-6 py-4 text-[#1e293b] focus:border-[#0f172a] focus:bg-white outline-none transition-all"
                                        placeholder="RS-XXXX-A"
                                    />
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
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#005d31] hover:bg-[#004d29] text-white transition-all shadow-lg shadow-[#005d31]/20 border-0 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : editingProduct ? 'Actualizar Producto' : 'Registrar Producto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
