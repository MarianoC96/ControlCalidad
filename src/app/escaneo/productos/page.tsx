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
        <div className="min-h-screen bg-slate-950 p-6 lg:pl-[--sidebar-width] transition-all pb-24">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2" onClick={() => router.push('/escaneo')}>
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors">
                                <i className="bi bi-arrow-left"></i>
                            </div>
                            <span className="text-[10px] text-green-500 font-black uppercase tracking-[0.2em]">Escaneo / Productos</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Productos de Escaneo</h1>
                        <p className="text-slate-400 font-medium">Gestión de códigos de barras universales y especificaciones.</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-green-500/20 active:scale-95 flex items-center gap-3 shrink-0"
                    >
                        <i className="bi bi-plus-circle-fill text-lg"></i>
                        Nuevo SKU
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input
                            type="text"
                            placeholder="Buscar por código de barras o nombre del producto..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-green-500/50 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* List Container */}
                <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden pb-4">
                    {/* Header Row */}
                    <div className="hidden md:grid grid-cols-[3fr_2fr_1fr] gap-4 p-6 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/50">
                        <div className="pl-4">Producto</div>
                        <div>Parámetros</div>
                        <div className="flex justify-end pr-8">Acciones</div>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-white/5">
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-slate-900 animate-pulse m-4 rounded-2xl"></div>)
                        ) : paginatedProducts.length === 0 ? (
                            <div className="py-20 text-center space-y-4">
                                <i className="bi bi-box-seam text-4xl text-slate-700"></i>
                                <div>
                                    <h3 className="text-white font-bold text-lg">No hay productos encontrados</h3>
                                </div>
                            </div>
                        ) : (
                            paginatedProducts.map(product => (
                                <div key={product.barcode} className="grid grid-cols-1 md:grid-cols-[3fr_2fr_1fr] gap-4 p-6 hover:bg-white/[0.02] transition-colors items-center group">
                                    {/* Producto info */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center font-bold text-xl shrink-0 border border-green-500/20 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                            {product.presentacion.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-white font-bold text-base md:text-lg truncate">{product.presentacion}</h3>
                                            <p className="text-xs font-mono text-slate-500 mt-0.5">ID: {product.barcode}</p>
                                        </div>
                                    </div>

                                    {/* Parámetros */}
                                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-950 border border-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider w-fit whitespace-nowrap">
                                            Vida: {product.vida_util || 'N/A'}
                                        </span>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-950 border border-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider w-fit whitespace-nowrap">
                                            Caja: {product.unidades_por_caja} Ud.
                                        </span>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-start md:justify-end gap-2 md:pr-4">
                                        <button onClick={() => openEditModal(product)} className="w-10 h-10 rounded-xl bg-slate-950 border border-white/5 text-slate-400 hover:text-white hover:border-green-500/50 hover:bg-green-500/20 transition-all flex items-center justify-center">
                                            <i className="bi bi-pencil-fill"></i>
                                        </button>
                                        <button onClick={() => handleDelete(product.barcode)} className="w-10 h-10 rounded-xl bg-slate-950 border border-white/5 text-slate-400 hover:text-white hover:border-red-500/50 hover:bg-red-500/20 transition-all flex items-center justify-center">
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
                                Mostrando <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> de <span className="text-white">{filteredProducts.length}</span>
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
                                                ? 'bg-green-600 text-white shadow-lg shadow-green-600/20 border-transparent'
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

                        <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/5 rounded-full blur-3xl"></div>

                        <header className="mb-8 relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">Configure los metadatos globales del SKU.</p>
                        </header>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Código de Barras (Universal)</label>
                                <div className="relative">
                                    <input
                                        required
                                        disabled={!!editingProduct}
                                        value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-green-500 outline-none transition-all font-mono disabled:opacity-50"
                                        placeholder="775..."
                                    />
                                    <i className="bi bi-upc-scan absolute right-5 top-1/2 -translate-y-1/2 text-slate-700"></i>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Nombre / Presentación</label>
                                <input
                                    required
                                    value={formData.presentacion}
                                    onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-green-500 outline-none transition-all font-medium"
                                    placeholder="Ej: Aceituna Verde 200g"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Vida Útil</label>
                                    <input
                                        value={formData.vida_util}
                                        onChange={(e) => setFormData({ ...formData, vida_util: e.target.value })}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-green-500 outline-none transition-all"
                                        placeholder="Ej: 12 meses"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Unidades / Caja</label>
                                    <input
                                        type="number"
                                        value={formData.unidades_por_caja}
                                        onChange={(e) => setFormData({ ...formData, unidades_por_caja: e.target.value })}
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-green-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Registro Sanitario</label>
                                <input
                                    value={formData.registro_sanitario}
                                    onChange={(e) => setFormData({ ...formData, registro_sanitario: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-green-500 outline-none transition-all"
                                    placeholder="RS-XXXX-A"
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
                                className="flex-[1.5] bg-green-600 hover:bg-green-500 text-white py-5 px-10 rounded-2xl font-black transition-all text-xs uppercase tracking-widest shadow-xl shadow-green-500/20"
                            >
                                {isSaving ? 'GUARDANDO...' : editingProduct ? 'ACTUALIZAR' : 'REGISTRAR'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
