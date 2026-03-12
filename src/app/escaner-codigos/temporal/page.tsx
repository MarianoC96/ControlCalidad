'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeRepository } from '@/lib/repositories/barcode.repository';

interface OfflineScan {
    id: string;
    barcode: string;
    lote: string;
    usuario_id: number | null;
    mode: 'producto' | 'caja';
    presentacion?: string;
    created_at: string;
}

export default function TemporalScannerPage() {
    const router = useRouter();
    const [pendingScans, setPendingScans] = useState<OfflineScan[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);

    // Load from local storage on mount
    useEffect(() => {
        const loadQueue = () => {
            try {
                const queue = JSON.parse(localStorage.getItem('scanner_offline_queue') || '[]');
                // Sort oldest to newest
                queue.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setPendingScans(queue);
            } catch (err) {
                console.error("Error loading offline queue", err);
                setPendingScans([]);
            }
        };
        loadQueue();
    }, []);

    const saveQueue = (queue: OfflineScan[]) => {
        localStorage.setItem('scanner_offline_queue', JSON.stringify(queue));
        setPendingScans(queue);
    };

    const handleDelete = (id: string) => {
        if (!confirm('¿Seguro que deseas descartar permanentemente este registro temporal?')) return;
        const newQueue = pendingScans.filter((item) => item.id !== id);
        saveQueue(newQueue);
    };

    const handleSyncAll = async () => {
        if (!navigator.onLine) {
            alert('Aún no tienes conexión a internet para sincronizar.');
            return;
        }

        if (pendingScans.length === 0) return;

        setIsSyncing(true);
        setSyncProgress(0);

        let currentQueue = [...pendingScans];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < pendingScans.length; i++) {
            const scan = pendingScans[i];

            try {
                // REHIDRATACIÓN: Intentar buscar la info real del producto antes de subir
                const { data: masterData } = await BarcodeRepository.findByBarcode(scan.barcode, scan.mode);

                let metadataToSave: any = {
                    presentacion: scan.presentacion || 'Escaneo sin conexión (Offline)',
                    unidades: '0'
                };

                if (masterData) {
                    metadataToSave = {
                        presentacion: scan.mode === 'producto' ? masterData.presentacion : masterData.tipo_caja,
                        unidades: String(scan.mode === 'producto' ? masterData.unidades_por_caja : masterData.capacidad_max),
                        vida_util: masterData.vida_util,
                        registro_sanitario: masterData.registro_sanitario
                    };
                }

                const { error } = await BarcodeRepository.saveTransaction({
                    barcode: scan.barcode,
                    lote: scan.lote,
                    usuario_id: scan.usuario_id,
                    metadata: metadataToSave
                }, scan.mode);

                if (error) throw error;

                // Sync success, remove from current queue
                currentQueue = currentQueue.filter(item => item.id !== scan.id);
                successCount++;
            } catch (err) {
                console.error("Failed to sync item:", scan.id, err);
                failCount++;
            }

            setSyncProgress(Math.round(((i + 1) / pendingScans.length) * 100));
        }

        // Save remaining queue (failed items)
        saveQueue(currentQueue);
        setIsSyncing(false);

        if (failCount === 0) {
            alert(`✅ Sincronización completa. ${successCount} registros subidos.`);
        } else {
            alert(`⚠️ Sincronización parcial. Se subieron ${successCount} registros y fallaron ${failCount}. Revisa si los lotes/códigos son válidos.`);
        }
    };

    const handleSyncSingle = async (scan: OfflineScan) => {
        if (!navigator.onLine) {
            alert('Aún no tienes conexión a internet.');
            return;
        }

        setIsSyncing(true);
        try {
            // REHIDRATACIÓN: Intentar buscar la info real del producto antes de subir
            const { data: masterData } = await BarcodeRepository.findByBarcode(scan.barcode, scan.mode);

            let metadataToSave: any = {
                presentacion: scan.presentacion || 'Escaneo sin conexión (Offline)',
                unidades: '0'
            };

            if (masterData) {
                metadataToSave = {
                    presentacion: scan.mode === 'producto' ? masterData.presentacion : masterData.tipo_caja,
                    unidades: String(scan.mode === 'producto' ? masterData.unidades_por_caja : masterData.capacidad_max),
                    vida_util: masterData.vida_util,
                    registro_sanitario: masterData.registro_sanitario
                };
            }

            const { error } = await BarcodeRepository.saveTransaction({
                barcode: scan.barcode,
                lote: scan.lote,
                usuario_id: scan.usuario_id,
                metadata: metadataToSave
            }, scan.mode);

            if (error) throw error;

            const newQueue = pendingScans.filter((item) => item.id !== scan.id);
            saveQueue(newQueue);
            alert('Registro sincronizado exitosamente.');
        } catch (err: any) {
            console.error(err);
            alert(`Error de validación al sincronizar: ${err.message || 'Error desconocido'}`);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:pl-[--sidebar-width] transition-all pb-24">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-[#e2e8f0] pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2 cursor-pointer group" onClick={() => router.push('/escaner-codigos')}>
                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#64748b] group-hover:text-amber-500 transition-colors border border-[#e2e8f0]">
                                <i className="bi bi-arrow-left"></i>
                            </div>
                            <span className="text-[10px] text-[#94a3b8] group-hover:text-amber-500 font-black uppercase tracking-[0.2em] transition-colors">Menú Escaneo</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-[#1e293b] tracking-tighter uppercase m-0 leading-tight">Temporal</h1>
                        <p className="text-[#64748b] text-sm font-medium mt-1">Registros pendientes por sincronizar.</p>
                    </div>

                    <button
                        onClick={handleSyncAll}
                        disabled={isSyncing || pendingScans.length === 0}
                        className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 shrink-0 ${isSyncing || pendingScans.length === 0
                            ? 'bg-[#f1f5f9] text-[#cbd5e1] cursor-not-allowed shadow-none'
                            : 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20'
                            }`}
                    >
                        {isSyncing ? (
                            <>
                                <i className="bi bi-arrow-repeat animate-spin text-lg"></i>
                                {syncProgress}%
                            </>
                        ) : (
                            <>
                                <i className="bi bi-cloud-arrow-up-fill text-lg"></i>
                                Sincronizar ({pendingScans.length})
                            </>
                        )}
                    </button>
                </div>

                {/* List Container */}
                <div className="bg-[#ffffff] border border-[#cbd5e1] rounded-[2.5rem] shadow-2xl overflow-hidden pb-4">
                    {pendingScans.length === 0 ? (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-green-50 rounded-full mx-auto flex items-center justify-center text-green-500 mb-6">
                                <i className="bi bi-check2-circle text-4xl"></i>
                            </div>
                            <div>
                                <h3 className="text-[#1e293b] font-bold text-xl uppercase tracking-tight">Todo sincronizado</h3>
                                <p className="text-[#64748b] text-sm mt-2">No tienes escaneos pendientes almacenados en tu dispositivo local.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#f1f5f9]">
                            {pendingScans.map(scan => (
                                <div key={scan.id} className="flex flex-col md:grid md:grid-cols-[2fr_1.5fr_1fr] gap-5 p-5 sm:p-6 hover:bg-[#f8fafc] transition-colors items-center group">

                                    {/* Info Principal */}
                                    <div className="flex items-center gap-4 w-full min-w-0">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 border transition-all ${scan.mode === 'producto'
                                            ? 'bg-green-50 text-[#208754] border-green-100 group-hover:bg-[#208754] group-hover:text-white'
                                            : 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-500 group-hover:text-white'
                                            }`}>
                                            <i className={`bi ${scan.mode === 'producto' ? 'bi-upc-scan' : 'bi-box-seam'}`}></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="text-[#1e293b] font-black text-base sm:text-lg truncate m-0 leading-tight">{scan.lote}</h3>
                                                <span className="bg-amber-100 text-amber-700 text-[8px] sm:text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-amber-200">OFFLINE</span>
                                            </div>
                                            <p className="text-[10px] font-mono font-bold text-[#94a3b8] uppercase tracking-widest leading-none">ID: {scan.barcode}</p>
                                        </div>
                                    </div>

                                    {/* Metadatos */}
                                    <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-1 w-full text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                                        <div className="flex items-center gap-2">
                                            <i className="bi bi-layers-fill"></i>
                                            TIPO: {scan.mode}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <i className="bi bi-clock-fill"></i>
                                            {new Date(scan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-end gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-[#f1f5f9]">
                                        <button
                                            onClick={() => handleSyncSingle(scan)}
                                            disabled={isSyncing}
                                            className="flex-1 md:flex-none h-11 w-11 rounded-xl bg-green-50 text-[#208754] hover:bg-[#208754] hover:text-white transition-all border border-green-100 flex items-center justify-center shadow-sm"
                                            title="Sincronizar ahora"
                                        >
                                            <i className="bi bi-cloud-arrow-up-fill text-lg"></i>
                                            <span className="md:hidden ml-2 font-bold text-sm uppercase">Subir</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(scan.id)}
                                            disabled={isSyncing}
                                            className="flex-1 md:flex-none h-11 w-11 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-100 flex items-center justify-center shadow-sm"
                                            title="Eliminar"
                                        >
                                            <i className="bi bi-trash3-fill text-lg"></i>
                                            <span className="md:hidden ml-2 font-bold text-sm uppercase">Borrar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
