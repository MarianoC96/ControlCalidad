'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { BarcodeRepository } from '@/lib/repositories/barcode.repository';
import { useAuth } from '@/hooks/useAuth';
import { formatBarcode } from '@/lib/utils';

interface ScanInfo {
    barcode: string;
    vida_util?: string;
    registro_sanitario?: string;
    presentacion: string;
    unidades_por_caja: string;
    tipo_envase?: string;
    unidades_por_paleta?: string;
    is_match: boolean;
    scanTime: string;
    imagen_url?: string;
}

export default function EscaneoPage() {
    const router = useRouter();
    const { user } = useAuth();

    // --- AUTH PERMISSIONS ---
    const isAdmin = user?.roles === 'administrador';
    const canManageProducts = isAdmin || user?.permiso_escaneo_productos;
    const canManageBoxes = isAdmin || user?.permiso_escaneo_cajas;
    const canViewHistory = isAdmin || user?.permiso_escaneo_historial;

    // --- ESTADOS PRINCIPALES ---
    const [scanModeState, setScanModeState] = useState<'producto' | 'caja' | null>(null);
    const scanModeRef = useRef<'producto' | 'caja' | null>(null);
    const scanMode = scanModeState;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode') as 'producto' | 'caja';
        if (mode === 'producto' || mode === 'caja') {
            setScanModeState(mode);
            scanModeRef.current = mode;
            // Auto start scanner if mode is provided
            setTimeout(() => {
                startScanner(mode);
            }, 500);
        }
    }, [router]);

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const setScanMode = useCallback((mode: 'producto' | 'caja' | null) => {
        scanModeRef.current = mode;
        setScanModeState(mode);
    }, []);

    const [lastScanned, setLastScanned] = useState<ScanInfo | null>(null);
    const [loteValue, setLoteValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // --- ESTADOS DEL MODAL ESCÁNER ---
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);

    // --- LÓGICA DE ESCANEO ---
    const stopScanner = useCallback(async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
        setShowScannerModal(false);
        setIsInitializing(false);

        // When stopping, we remove the mode from URL to show menu again
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.toString());
        setScanMode(null);
    }, [setScanMode]);

    const lookupBarcode = useCallback(async (barcode: string) => {
        const currentMode = scanModeRef.current;
        if (!currentMode) return;

        const normalizedBarcode = formatBarcode(barcode, currentMode);

        try {
            const { data, error } = await BarcodeRepository.findByBarcode(normalizedBarcode, currentMode);

            // Si hay error de red o no hay datos por falta de conexión
            if (error && (error.message.includes('network') || error.message.includes('Fetch') || !navigator.onLine)) {
                throw new Error('Network offline');
            }

            // Resolvemos data basado en el módulo
            let presentacionText = 'No encontrado';
            let unidadesText = '0';

            if (data) {
                if (currentMode === 'producto') {
                    presentacionText = data.presentacion || data.nombre || 'Producto sin nombre';
                    unidadesText = String(data.unidades_por_caja || '0');
                } else {
                    presentacionText = data.tipo_caja || 'Caja sin tipo';
                    unidadesText = String(data.capacidad_max || '0');
                }
            } else if (!error) {
                presentacionText = 'No registrado en catálogo';
            }

            const scanResult: ScanInfo = {
                barcode: normalizedBarcode,
                scanTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_match: !error && !!data,
                presentacion: presentacionText,
                unidades_por_caja: unidadesText,
                vida_util: data?.vida_util,
                registro_sanitario: data?.registro_sanitario,
                tipo_envase: data?.tipo_envase,
                unidades_por_paleta: data?.unidades_por_paleta != null ? String(data.unidades_por_paleta) : undefined,
                imagen_url: data?.imagen_url
            };

            setLastScanned(scanResult);

            // Audio feed-back
            const audio = new Audio('/beep.mp3');
            audio.play().catch(() => { });

            // Stop scanner after successful scan
            if (scannerRef.current && scannerRef.current.isScanning) {
                await scannerRef.current.stop();
            }
            setShowScannerModal(false);

        } catch (err: any) {
            console.warn("Lookup handled offline:", err);

            // FALLBACK OFFLINE: Si falla la red, permitimos el registro
            const fallbackResult: ScanInfo = {
                barcode: normalizedBarcode,
                scanTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_match: true, // Permitimos guardar offline
                presentacion: 'Escaneo sin conexión (Offline)',
                unidades_por_caja: '?',
            };

            setLastScanned(fallbackResult);

            // Stop scanner even on error if it's a "known" network error
            if (scannerRef.current && scannerRef.current.isScanning) {
                await scannerRef.current.stop();
            }
            setShowScannerModal(false);
            // No seteamos setError para no bloquear la pantalla en offline
        }
    }, []);

    const startScanner = useCallback(async (mode: 'producto' | 'caja') => {
        setScanMode(mode);
        setError(null);
        setShowScannerModal(true);
        setIsInitializing(true);

        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('mode', mode);
        window.history.replaceState({}, '', url.toString());

        setTimeout(async () => {
            try {
                const scanner = new Html5Qrcode("scanner-container", {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.EAN_8
                    ],
                    verbose: false
                });
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 280, height: 160 },
                        aspectRatio: 1
                    },
                    (decodedText) => {
                        console.log("Scanned:", decodedText);
                        lookupBarcode(decodedText);
                    },
                    (errorMessage) => {
                        // console.log(errorMessage);
                    }
                );
                setIsInitializing(false);
            } catch (err: any) {
                console.error("Camera Error:", err);
                setError(err.message || "No se pudo acceder a la cámara");
                setIsInitializing(false);
            }
        }, 300);
    }, [lookupBarcode, setScanMode]);

    const handleBackToModules = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.toString());
        setScanMode(null);
        setLastScanned(null);
        setLoteValue('');
    };

    const saveTransaction = async () => {
        if (!lastScanned || !loteValue.trim() || !scanMode) return;
        setIsSaving(true);

        try {
            const { error } = await BarcodeRepository.saveTransaction({
                barcode: lastScanned.barcode,
                lote: loteValue.trim().toUpperCase(),
                usuario_id: user?.id || null,
                metadata: {
                    presentacion: lastScanned.presentacion,
                    unidades: lastScanned.unidades_por_caja,
                    vida_util: lastScanned.vida_util,
                    registro_sanitario: lastScanned.registro_sanitario,
                    tipo_envase: lastScanned.tipo_envase,
                    unidades_por_paleta: lastScanned.unidades_por_paleta,
                    imagen_url: lastScanned.imagen_url
                }
            }, scanMode);

            if (error) throw error;

            alert("Registro guardado exitosamente");
            handleBackToModules();
        } catch (err: any) {
            console.error(err);

            // Error handling for offline or validation
            if (err.message?.includes('network') || !navigator.onLine) {
                // Storage offline queue
                const queue = JSON.parse(localStorage.getItem('scanner_offline_queue') || '[]');
                queue.push({
                    id: Math.random().toString(36).substr(2, 9),
                    barcode: lastScanned.barcode,
                    lote: loteValue.trim().toUpperCase(),
                    usuario_id: user?.id || null,
                    mode: scanMode,
                    presentacion: lastScanned.presentacion,
                    tipo_envase: lastScanned.tipo_envase,
                    unidades_por_paleta: lastScanned.unidades_por_paleta,
                    imagen_url: lastScanned.imagen_url,
                    created_at: new Date().toISOString()
                });
                localStorage.setItem('scanner_offline_queue', JSON.stringify(queue));
                alert("Estás sin conexión. El registro se guardó localmente y podrás sincronizarlo en el menú 'Temporal'.");
                handleBackToModules();
            } else {
                alert(`Error: ${err.message || "No se pudo guardar el registro"}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col pl-0 lg:pl-[--sidebar-width] transition-all overflow-x-hidden pb-32">

            {/* --- MODAL DE CÁMARA --- */}
            {showScannerModal && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-xl" onClick={stopScanner}></div>

                    <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
                        <div className="p-5 flex items-center justify-between border-b border-[#e2e8f0] bg-white shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                                    <i className="bi bi-camera"></i>
                                </div>
                                <div className="text-left">
                                    <h4 className="text-[#1e293b] font-black text-sm uppercase tracking-tight m-0 leading-none">Cámara Activa</h4>
                                    <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest m-0 leading-none mt-0.5">Enfoca el código de barras</p>
                                </div>
                            </div>
                            <button onClick={stopScanner} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] flex items-center justify-center text-[#1e293b] transition-transform active:scale-90 border-0 shadow-sm">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        <div className="relative bg-[#000] aspect-square w-full">
                            <div id="scanner-container" className="w-full h-full"></div>
                            {isInitializing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] text-white gap-4">
                                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Inicializando Cámara...</span>
                                </div>
                            )}
                            {error && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 text-red-600 p-8 text-center gap-4">
                                    <i className="bi bi-exclamation-triangle text-4xl"></i>
                                    <p className="font-bold text-sm">{error}</p>
                                    <button onClick={() => startScanner(scanMode!)} className="bg-red-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest">Reintentar</button>
                                </div>
                            )}

                            {/* Overlay Scanner UI */}
                            {!isInitializing && !error && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div className="w-[280px] h-[160px] border-2 border-blue-400/50 rounded-2xl relative">
                                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/40 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-[#f8fafc] text-center border-t border-[#e2e8f0]">
                            <p className="text-[#64748b] text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                                Mantén el código centrado y a una distancia fija para una lectura óptima.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VISTA 1: MENÚ DE MÓDULOS --- */}
            {!scanMode && (
                <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
                    {/* Background Ambient Effects */}
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#e0f2fe]/60 to-transparent pointer-events-none"></div>
                    <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#208754]/5 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-[#b5b74b]/10 rounded-full blur-[80px] pointer-events-none"></div>

                    <main className="relative z-10 flex-1 flex flex-col p-5 sm:p-8 items-center justify-center gap-6 animate-in fade-in zoom-in-95 duration-700 max-w-lg mx-auto w-full">

                        {/* Premium Header */}
                        <div className="text-center mb-4 sm:mb-8">
                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 group cursor-default">
                                <div className="absolute inset-2 bg-gradient-to-tr from-[#208754] to-[#b5b74b] blur-xl opacity-40 group-hover:opacity-70 group-hover:scale-110 transition-all duration-500 rounded-full animate-pulse"></div>
                                <div className="relative w-full h-full bg-white/90 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center border border-white backdrop-blur-xl transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_rgba(32,135,84,0.15)] overflow-hidden">
                                    <i className="bi bi-shield-check text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-[#005d31] to-[#208754] drop-shadow-sm relative z-10 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_5px_10px_rgba(0,93,49,0.3)]"></i>
                                </div>
                            </div>
                            <h1 className="text-[#1e293b] text-3xl sm:text-4xl font-black uppercase tracking-tight m-0 bg-clip-text text-transparent bg-gradient-to-r from-[#1e293b] to-[#475569]">Menú Escaneo</h1>
                            <div className="inline-flex items-center gap-2 mt-3 bg-white/60 px-4 py-1.5 rounded-full border border-white/80 shadow-sm backdrop-blur-md">
                                <span className="w-1.5 h-1.5 bg-[#208754] rounded-full animate-pulse"></span>
                                <p className="text-[#64748b] text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] m-0">Planta El Olivar</p>
                            </div>
                        </div>

                        {/* Contenedor Principal de Escáneres */}
                        <div className="w-full space-y-4 relative">
                            <button
                                onClick={() => startScanner('producto')}
                                className="w-full bg-white/80 backdrop-blur-xl border border-white hover:border-[#208754]/30 p-5 sm:p-6 rounded-[2rem] flex items-center gap-5 sm:gap-6 group transition-all duration-300 active:scale-95 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(32,135,84,0.15)] cursor-pointer overflow-hidden relative"
                            >
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#208754]/10 to-[#208754]/5 border border-[#208754]/10 text-[#208754] flex items-center justify-center text-2xl sm:text-3xl group-hover:bg-[#208754] group-hover:text-white transition-all duration-300 shadow-inner shrink-0 relative z-10">
                                    <i className="bi bi-upc-scan"></i>
                                </div>
                                <div className="text-left flex-1 min-w-0 relative z-10">
                                    <h3 className="text-[#1e293b] font-black text-lg sm:text-xl uppercase tracking-tight mb-0.5 truncate group-hover:text-[#005d31] transition-colors">Productos</h3>
                                    <p className="text-[10px] sm:text-[11px] text-[#64748b] font-bold tracking-widest uppercase">Escaneo de Lotes</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#208754]/10 transition-colors shrink-0">
                                    <i className="bi bi-chevron-right text-[#cbd5e1] group-hover:text-[#208754] group-hover:translate-x-0.5 transition-all text-sm"></i>
                                </div>
                            </button>

                            <button
                                onClick={() => startScanner('caja')}
                                className="w-full bg-white/80 backdrop-blur-xl border border-white hover:border-[#b5b74b]/30 p-5 sm:p-6 rounded-[2rem] flex items-center gap-5 sm:gap-6 group transition-all duration-300 active:scale-95 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(181,183,75,0.15)] cursor-pointer overflow-hidden relative"
                            >
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#b5b74b]/10 to-[#b5b74b]/5 border border-[#b5b74b]/10 text-[#b5b74b] flex items-center justify-center text-2xl sm:text-3xl group-hover:bg-[#b5b74b] group-hover:text-white transition-all duration-300 shadow-inner shrink-0 relative z-10">
                                    <i className="bi bi-box-seam"></i>
                                </div>
                                <div className="text-left flex-1 min-w-0 relative z-10">
                                    <h3 className="text-[#1e293b] font-black text-lg sm:text-xl uppercase tracking-tight mb-0.5 truncate group-hover:text-[#7b7c2b] transition-colors">Cajas / Empaque</h3>
                                    <p className="text-[10px] sm:text-[11px] text-[#64748b] font-bold tracking-widest uppercase">Trazabilidad Web</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#b5b74b]/10 transition-colors shrink-0">
                                    <i className="bi bi-chevron-right text-[#cbd5e1] group-hover:text-[#b5b74b] group-hover:translate-x-0.5 transition-all text-sm"></i>
                                </div>
                            </button>
                        </div>

                        {/* CRUD DE PRODUCTOS Y CAJAS */}
                        <div className="w-full relative mt-4">
                            <div className="grid grid-cols-2 gap-4 p-2">
                                {canManageProducts ? (
                                    <button
                                        onClick={() => router.push('/escaner-codigos/productos')}
                                        className="bg-white/60 backdrop-blur-sm border border-white hover:border-[#005d31]/20 p-5 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all duration-300 active:scale-95 text-center group cursor-pointer shadow-sm hover:shadow-md hover:bg-white"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#64748b] border border-slate-200/50 group-hover:text-[#208754] group-hover:border-[#208754]/20 group-hover:bg-[#208754]/5 flex items-center justify-center text-xl transition-all">
                                            <i className="bi bi-journal-check"></i>
                                        </div>
                                        <span className="text-[10px] text-[#64748b] font-black uppercase tracking-widest group-hover:text-[#1e293b] transition-colors">Maestro Prod.</span>
                                    </button>
                                ) : null}

                                {canManageBoxes ? (
                                    <button
                                        onClick={() => router.push('/escaner-codigos/cajas')}
                                        className="bg-white/60 backdrop-blur-sm border border-white hover:border-[#969836]/20 p-5 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all duration-300 active:scale-95 text-center group cursor-pointer shadow-sm hover:shadow-md hover:bg-white"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#64748b] border border-slate-200/50 group-hover:text-[#b5b74b] group-hover:border-[#b5b74b]/20 group-hover:bg-[#b5b74b]/5 flex items-center justify-center text-xl transition-all">
                                            <i className="bi bi-archive-fill"></i>
                                        </div>
                                        <span className="text-[10px] text-[#64748b] font-black uppercase tracking-widest group-hover:text-[#1e293b] transition-colors">Maestro Cajas</span>
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* BOTONES SECUNDARIOS */}
                        <div className="w-full flex flex-col gap-3 mt-4">
                            <button
                                onClick={() => router.push('/escaner-codigos/temporal')}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/30 border border-amber-200/60 text-amber-700 font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] hover:text-amber-800 hover:border-amber-300 hover:shadow-[0_4px_15px_rgba(251,191,36,0.15)] transition-all flex items-center justify-center gap-3 cursor-pointer"
                            >
                                <i className="bi bi-cloud-slash text-sm"></i>
                                Sincronización Temporal
                            </button>

                            {canViewHistory ? (
                                <button
                                    onClick={() => router.push('/escaner-codigos/historial')}
                                    className="w-full py-4 rounded-2xl bg-white/50 backdrop-blur-md border border-slate-200 text-[#475569] font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] hover:text-[#1e293b] hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer"
                                >
                                    <i className="bi bi-clock-history text-sm"></i>
                                    Registro de Historial
                                </button>
                            ) : null}
                        </div>
                    </main>
                </div>
            )}


            {/* --- VISTA 2: FORMULARIO DE LOTE (Layout 2 columnas) --- */}
            {scanMode && lastScanned && (
                <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 mt-4 sm:mt-10 animate-in slide-in-from-bottom-10 duration-500">
                    {/* Botón Volver */}
                    <button
                        onClick={handleBackToModules}
                        className="mb-6 flex items-center gap-2 text-[#94a3b8] hover:text-blue-500 font-black text-[10px] uppercase tracking-widest transition-colors active:scale-95 group border-0 bg-transparent"
                    >
                        <i className="bi bi-arrow-left-circle-fill text-xl transition-transform group-hover:-translate-x-1"></i>
                        Regresar al Menú
                    </button>

                    <div className="max-w-2xl mx-auto w-full">
                        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden border border-[#e2e8f0]">

                            {/* Header con cajas encapsuladas (Mockup style) */}
                            <div className={`p-6 sm:p-8 ${lastScanned.is_match ? (scanMode === 'producto' ? 'bg-green-50/40' : 'bg-amber-50/40') : 'bg-red-50/40'}`}>

                                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-stretch justify-center">
                                    {/* CAJA 1: Imagen Encapsulada */}
                                    <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center p-6 shrink-0">
                                        {lastScanned.imagen_url ? (
                                            <img
                                                src={lastScanned.imagen_url}
                                                alt={lastScanned.presentacion}
                                                className="max-w-full max-h-full object-contain rounded-xl"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2 text-[#cbd5e1]">
                                                <i className={`bi ${scanMode === 'producto' ? 'bi-image' : 'bi-box-seam'} text-4xl`}></i>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-center">Sin imagen</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* CAJA 2: Información Encapsulada */}
                                    <div className="flex-1 w-full bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center text-center sm:min-h-[220px]">
                                        <div className={`w-14 h-14 mb-4 rounded-2xl flex items-center justify-center text-3xl shadow-inner border transition-all ${lastScanned.is_match
                                            ? (scanMode === 'producto' ? 'bg-white text-[#208754] border-green-100' : 'bg-white text-amber-500 border-amber-100')
                                            : 'bg-white text-red-500 border-red-100 animate-shake'
                                            }`}>
                                            <i className={`bi ${lastScanned.is_match ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                                        </div>

                                        <h2 className="text-[#1e293b] text-xl sm:text-2xl font-black uppercase tracking-tight m-0 leading-tight">
                                            {lastScanned.presentacion}
                                        </h2>

                                        <div className="mt-4">
                                            <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${lastScanned.is_match ? 'bg-white text-slate-600 border-slate-200' : 'bg-red-100 text-red-600 border-red-200'
                                                }`}>
                                                ID: {lastScanned.barcode}
                                            </span>
                                            {!lastScanned.is_match && (
                                                <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2">Código no registrado</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cuerpo del Formulario */}
                            <div className="p-6 sm:p-8 space-y-8">
                                {/* Información Extra (Grid) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[#f8fafc] p-4 rounded-2xl border border-dashed border-slate-200">
                                        <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1.5">Capacidad/Caja</span>
                                        <div className="flex items-center gap-2 text-[#475569] font-black text-xs">
                                            <i className="bi bi-layers-fill text-blue-500"></i>
                                            {lastScanned.unidades_por_caja} Unid.
                                        </div>
                                    </div>
                                    <div className="bg-[#f8fafc] p-4 rounded-2xl border border-dashed border-slate-200">
                                        <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1.5">Hora Escaneo</span>
                                        <div className="flex items-center gap-2 text-[#475569] font-black text-xs">
                                            <i className="bi bi-clock-fill text-blue-500"></i>
                                            {lastScanned.scanTime}
                                        </div>
                                    </div>

                                    {/* Segunda Fila: Envase y Vida Útil */}
                                    {lastScanned.tipo_envase && (
                                        <div className="bg-[#f8fafc] p-4 rounded-2xl border border-dashed border-slate-200">
                                            <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1.5">Tipo de Envase</span>
                                            <div className="flex items-center gap-2 text-[#475569] font-black text-xs">
                                                <i className="bi bi-bag-fill text-purple-500"></i>
                                                {lastScanned.tipo_envase}
                                            </div>
                                        </div>
                                    )}
                                    {lastScanned.vida_util && (
                                        <div className={`bg-[#f8fafc] p-4 rounded-2xl border border-dashed border-slate-200 ${!lastScanned.tipo_envase ? 'col-span-2' : ''}`}>
                                            <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1.5">Vida Útil</span>
                                            <div className="flex items-center gap-2 text-[#475569] font-black text-xs">
                                                <i className="bi bi-calendar-check-fill text-green-500"></i>
                                                {lastScanned.vida_util}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tercera Fila: RS y Unidades Paleta (si aplica) */}
                                    {lastScanned.registro_sanitario && (
                                        <div className={`bg-[#f8fafc] p-4 rounded-2xl border border-dashed border-slate-200 ${!(lastScanned.unidades_por_paleta && lastScanned.unidades_por_paleta !== '0') ? 'col-span-2' : ''}`}>
                                            <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1.5">Registro Sanitario</span>
                                            <div className="flex items-center gap-2 text-[#475569] font-black text-[10px] sm:text-xs">
                                                <i className="bi bi-shield-check-fill text-blue-500"></i>
                                                {lastScanned.registro_sanitario}
                                            </div>
                                        </div>
                                    )}
                                    {lastScanned.unidades_por_paleta && lastScanned.unidades_por_paleta !== '0' && (
                                        <div className={`bg-[#f8fafc] p-4 rounded-2xl border border-dashed border-slate-200 ${!lastScanned.registro_sanitario ? 'col-span-2' : ''}`}>
                                            <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest mb-1.5">Uds / Paleta</span>
                                            <div className="flex items-center gap-2 text-[#475569] font-black text-xs">
                                                <i className="bi bi-grid-3x3-gap-fill text-orange-500"></i>
                                                {lastScanned.unidades_por_paleta}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input de Lote */}
                                <div className="space-y-4">
                                    <label className="block text-xs font-black text-[#1e293b] uppercase tracking-[0.2em] px-2">
                                        Ingresar Lote Interno:
                                    </label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 rounded-b-2xl scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-500 z-10"></div>
                                        <input
                                            type="text"
                                            placeholder="EJ: MAR-2401-A"
                                            value={loteValue}
                                            onChange={(e) => setLoteValue(e.target.value.toUpperCase())}
                                            className="w-full bg-[#f8fafc] border-2 border-[#e2e8f0] focus:border-blue-500/20 rounded-2xl px-6 py-5 text-2xl font-black text-[#1e293b] text-center tracking-[0.2em] outline-none transition-all placeholder:text-[#cbd5e1] shadow-inner"
                                            autoFocus
                                        />
                                        <div className="absolute top-1/2 -translate-y-1/2 right-6">
                                            <i className="bi bi-pencil-fill text-[#cbd5e1] group-focus-within/input:text-blue-500 transition-colors"></i>
                                        </div>
                                    </div>
                                </div>

                                {/* Botón de Acción */}
                                <button
                                    onClick={saveTransaction}
                                    disabled={isSaving || !loteValue.trim() || !lastScanned.is_match}
                                    className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 border-0 ${isSaving || !loteValue.trim() || !lastScanned.is_match
                                        ? 'bg-[#f1f5f9] text-[#cbd5e1] cursor-not-allowed shadow-none'
                                        : (scanMode === 'producto' ? 'bg-[#208754] hover:bg-[#156d42] text-white shadow-[#208754]/20' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20')
                                        }`}
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-cloud-arrow-up-fill text-xl"></i>
                                            Confirmar Registro
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 text-center space-y-4">
                            <button
                                onClick={() => startScanner(scanMode!)}
                                className="bg-white/60 hover:bg-white text-[#475569] hover:text-blue-500 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all shadow-sm active:scale-95"
                            >
                                <i className="bi bi-arrow-repeat mr-2"></i>
                                Volver a Escanear
                            </button>
                            <p className="text-[#94a3b8] text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                                Los datos se guardan en la nube tras confirmación
                            </p>
                        </div>
                    </div>
                </main>
            )}

            {/* Empty States when mode selected but no scan yet */}
            {scanMode && !lastScanned && !showScannerModal && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
                    <div className="w-24 h-24 rounded-[2rem] bg-white shadow-xl flex items-center justify-center text-slate-200 text-4xl mb-6">
                        <i className={`bi ${scanMode === 'producto' ? 'bi-upc-scan' : 'bi-box-seam'}`}></i>
                    </div>
                    <h3 className="text-[#1e293b] font-black text-xl mb-2 uppercase tracking-tight">Esperando Escaneo</h3>
                    <p className="text-[#64748b] text-sm text-center max-w-xs mb-8">Debes escanear un código de barras para habilitar el formulario de registro.</p>
                    <button
                        onClick={() => startScanner(scanMode)}
                        className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl active:scale-95 transition-all border-0 ${scanMode === 'producto' ? 'bg-[#208754] hover:bg-[#156d42] shadow-[#208754]/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                            }`}
                    >
                        Abrir Cámara
                    </button>
                    <button onClick={handleBackToModules} className="mt-4 text-[#94a3b8] hover:text-[#475569] font-bold text-[10px] uppercase tracking-widest bg-transparent border-0">Regresar</button>
                </div>
            )}
        </div>
    );
}
