'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AgregarProductoPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulación de guardado
        setTimeout(() => {
            setLoading(false);
            setSuccess(true);
            setTimeout(() => router.push('/escaneo'), 2000);
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:pl-[--sidebar-width] flex items-center justify-center">
            <div className="w-full max-w-2xl bg-slate-900 rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">

                {/* Decorative Background */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-green-600/10 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Nuevo Producto</h1>
                        <p className="text-slate-400">Registra un SKU en el catálogo maestro de escaneo.</p>
                    </header>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="form-group col-span-1 md:col-span-2">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Código de Barras (Universal)</label>
                                <div className="relative">
                                    <input required placeholder="Escribir código manualmente..." className="w-full bg-slate-800 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-green-500 outline-none transition-all" />
                                    <i className="bi bi-barcode absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl"></i>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Vida Útil</label>
                                <input required placeholder="Ej: 12 meses" className="w-full bg-slate-800 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-green-500 outline-none transition-all" />
                            </div>

                            <div className="form-group">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Reg. Sanitario</label>
                                <input required placeholder="Ej: RS-0000-X" className="w-full bg-slate-800 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-green-500 outline-none transition-all" />
                            </div>

                            <div className="form-group">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Presentación</label>
                                <input required placeholder="Ej: Botella 1L" className="w-full bg-slate-800 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-green-500 outline-none transition-all" />
                            </div>

                            <div className="form-group">
                                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Unidades por Caja</label>
                                <input required type="number" placeholder="Ej: 12" className="w-full bg-slate-800 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-green-500 outline-none transition-all" />
                            </div>
                        </div>

                        {success && (
                            <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 flex items-center gap-3 animate-bounce">
                                <i className="bi bi-check-circle-fill"></i> ¡Producto registrado exitosamente! Redirigiendo...
                            </div>
                        )}

                        <div className="pt-4 flex gap-4">
                            <button type="button" onClick={() => router.back()} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-bold transition-all border border-white/5">
                                ATRÁS
                            </button>
                            <button disabled={loading} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-green-500/20">
                                {loading ? 'GUARDANDO...' : 'REGISTRAR PRODUCTO'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
