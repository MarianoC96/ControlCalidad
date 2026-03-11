'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { BarcodeRepository } from '@/lib/repositories/barcode.repository';
import { useAuth } from '@/hooks/useAuth';

interface ScanInfo {
    barcode: string;
    vida_util?: string;
    registro_sanitario?: string;
    presentacion: string;
    unidades_por_caja: string;
    is_match: boolean;
    scanTime: string;
}

export default function EscaneoPage() {
    const router = useRouter();
    // --- ESTADOS PRINCIPALES ---
    const [scanModeState, setScanModeState] = useState<'producto' | 'caja' | null>(null);
    const scanModeRef = useRef<'producto' | 'caja' | null>(null);
    const scanMode = scanModeState;

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
    }, []);

    const lookupBarcode = useCallback(async (barcode: string) => {
        const currentMode = scanModeRef.current;
        if (!currentMode) return;

        try {
            const { data, error } = await BarcodeRepository.findByBarcode(barcode, currentMode);

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
                barcode,
                scanTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_match: !error && !!data,
                presentacion: presentacionText,
                unidades_por_caja: unidadesText,
                vida_util: data?.vida_util,
                registro_sanitario: data?.registro_sanitario
            };

            setLastScanned(scanResult);

        } catch (err) {
            console.error("Lookup error:", err);
            setError("Error al consultar base de datos");
        }
    }, []);

    const startScanner = useCallback(async (modeToStart?: 'producto' | 'caja') => {
        if (modeToStart) setScanMode(modeToStart);
        setShowScannerModal(true);
        setIsInitializing(true);
        setError(null);

        setTimeout(async () => {
            try {
                const element = document.getElementById("reader");
                if (!element) return;

                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode("reader");
                }

                const config = {
                    fps: 10,
                    // Devolvemos el qrbox para evitar que se confunda escaneando las esquinas oscuras
                    qrbox: { width: 300, height: 200 },
                    disableFlip: false,
                    // Deshabilitado el motor nativo porque no todos los navegadores PC lo manejan sin crashear
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: false
                    }
                };

                await scannerRef.current.start(
                    // Al quitar los forzados de resolución (ideal/min), dejamos que la webcam decida su mejor formato natural sin ahogarse
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        lookupBarcode(decodedText);
                        stopScanner();
                    },
                    () => { }
                );

                setIsInitializing(false);
            } catch (err: any) {
                if (err?.name === "NotAllowedError" || String(err).includes("NotAllowedError")) {
                    console.warn("⚠️ Cámara bloqueada o no disponible en este dispositivo (Probablemente estés en PC o faltan permisos).");
                } else {
                    console.warn(`Scanner start alert: ${err}`);
                }
                setError("Cámara no disponible. Revisa los permisos.");
                setIsInitializing(false);
            }
        }, 300);
    }, [lookupBarcode, stopScanner, setScanMode]);

    useEffect(() => {
        return () => {
            if (scannerRef.current) stopScanner();
        };
    }, [stopScanner]);

    const { userId, user } = useAuth();

    // Auth Helper Variables
    const isAdmin = user?.roles === 'administrador';
    const canManageProducts = isAdmin || user?.permiso_escaneo_productos;
    const canManageBoxes = isAdmin || user?.permiso_escaneo_cajas;
    const canViewHistory = isAdmin || user?.permiso_escaneo_historial;

    // --- ACCIONES DE USUARIO ---
    const handleDiscard = () => {
        setLastScanned(null);
        setLoteValue('');
        setScanMode(null);
    };

    const handleBackToModules = () => {
        setScanMode(null);
        setLastScanned(null);
        setLoteValue('');
    };

    const saveTransaction = async () => {
        if (!lastScanned || !scanMode || !loteValue.trim()) return;

        setIsSaving(true);
        const transactionData = {
            barcode: lastScanned.barcode,
            lote: loteValue.trim().toUpperCase(),
            usuario_id: userId,
            presentacion: lastScanned.presentacion // Para referencia local
        };

        if (!navigator.onLine) {
            try {
                const pendingScans = JSON.parse(localStorage.getItem('scanner_offline_queue') || '[]');
                pendingScans.push({
                    ...transactionData,
                    id: Date.now() + Math.random().toString(36).substring(7),
                    mode: scanMode,
                    created_at: new Date().toISOString()
                });
                localStorage.setItem('scanner_offline_queue', JSON.stringify(pendingScans));
                
                setLastScanned(null);
                setLoteValue('');
                setScanMode(null);
                alert('Sin conexión: Transacción guardada en Temporal (Offline).');
            } catch(e) {
                alert('Error al guardar localmente.');
            } finally {
                setIsSaving(false);
            }
            return;
        }

        try {
            const { error } = await BarcodeRepository.saveTransaction(transactionData, scanMode);

            if (error) throw error;

            // Transición post-guardado
            setLastScanned(null);
            setLoteValue('');
            setScanMode(null);
            alert('Transacción guardada exitosamente.');
        } catch (err: any) {
            console.error(err);
            if (err?.message === 'Failed to fetch' || String(err).includes('fetch') || String(err).includes('network')) {
                const pendingScans = JSON.parse(localStorage.getItem('scanner_offline_queue') || '[]');
                pendingScans.push({
                    ...transactionData,
                    id: Date.now() + Math.random().toString(36).substring(7),
                    mode: scanMode,
                    created_at: new Date().toISOString()
                });
                localStorage.setItem('scanner_offline_queue', JSON.stringify(pendingScans));
                alert('Problema de red: Transacción guardada en Temporal (Offline).');
                setLastScanned(null);
                setLoteValue('');
                setScanMode(null);
            } else {
                alert('Error guardando la transacción en la base de datos.');
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
                    <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-xl" onClick={() => { stopScanner(); setScanMode(null); }}></div>

                    <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
                        <div className="p-5 flex items-center justify-between border-b border-[#e2e8f0] bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scanMode === 'producto' ? 'bg-[#208754]/10 text-[#208754]' : 'bg-[#b5b74b]/10 text-[#b5b74b]'}`}>
                                    <i className={`bi ${scanMode === 'producto' ? 'bi-upc-scan' : 'bi-box-seam'} text-xl`}></i>
                                </div>
                                <div>
                                    <h4 className="text-[#1e293b] font-black text-xs uppercase tracking-tighter m-0">
                                        Escaneo de {scanMode}
                                    </h4>
                                    <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest m-0 leading-none mt-0.5">Enfoca el código de barras</p>
                                </div>
                            </div>
                            <button onClick={() => { stopScanner(); setScanMode(null); }} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] flex items-center justify-center text-[#1e293b] transition-transform active:scale-90 border-0 shadow-sm">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                            <div id="reader" className="w-full h-full object-cover"></div>
                            {!isInitializing && !error && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                                    <div className={`w-full max-w-[280px] aspect-[1.8/1] border-2 rounded-2xl relative transition-all duration-500 border-dashed ${scanMode === 'producto' ? 'border-[#208754] shadow-[0_0_30px_rgba(34,197,94,0.4)]' : 'border-[#b5b74b] shadow-[0_0_30px_rgba(181,183,75,0.4)]'}`}>
                                        <div className={`absolute left-0 right-0 h-0.5 transition-all animate-scan-neon ${scanMode === 'producto' ? 'bg-[#208754]' : 'bg-[#b5b74b]'}`}></div>
                                    </div>
                                </div>
                            )}
                            {isInitializing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 transition-all">
                                    <div className={`w-12 h-12 border-4 border-slate-800 rounded-full animate-spin ${scanMode === 'producto' ? 'border-t-[#22c55e]' : 'border-t-[#eab308]'}`}></div>
                                    <p className="text-slate-400 mt-6 text-[10px] font-black tracking-[0.3em] uppercase">Iniciando Sensor</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOP NAV HEADER --- */}
            {scanMode && (
                <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-[#f8fafc]/90 backdrop-blur-xl border-b border-[#e2e8f0] shadow-2xl h-[72px]">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={handleBackToModules}>
                        <div className="w-10 h-10 bg-[#f1f5f9] text-[#64748b] rounded-xl flex items-center justify-center hover:text-[#1e293b] transition-all">
                            <i className="bi bi-arrow-left"></i>
                        </div>
                        <div>
                            <h1 className="text-[#1e293b] font-black tracking-tighter text-sm leading-none uppercase">Módulo {scanMode}s</h1>
                            <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest mt-0.5">Control Individual</p>
                        </div>
                    </div>
                </header>
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
                                    <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent opacity-80 h-1/2 rounded-t-[2rem] z-0"></div>
                                    <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_20px_rgba(0,0,0,0.02)] border border-slate-100/50"></div>
                                    <i className="bi bi-shield-check text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-[#005d31] to-[#208754] drop-shadow-sm relative z-10 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_5px_10px_rgba(0,93,49,0.3)]"></i>
                                </div>
                            </div>
                            <h2 className="text-[#1e293b] text-3xl sm:text-4xl font-black uppercase tracking-tight m-0 bg-clip-text text-transparent bg-gradient-to-r from-[#1e293b] to-[#475569]">Menú Principal</h2>
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
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
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
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
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
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 to-transparent rounded-[2.5rem] -z-10"></div>
                            <div className="grid grid-cols-2 gap-4 p-2">
                                {canManageProducts ? (
                                    <button
                                        onClick={() => router.push('/escaneo/productos')}
                                        className="bg-white/60 backdrop-blur-sm border border-white hover:border-[#005d31]/20 p-5 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all duration-300 active:scale-95 text-center group cursor-pointer shadow-sm hover:shadow-md hover:bg-white"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#64748b] border border-slate-200/50 group-hover:text-[#208754] group-hover:border-[#208754]/20 group-hover:bg-[#208754]/5 flex items-center justify-center text-xl transition-all">
                                            <i className="bi bi-journal-check"></i>
                                        </div>
                                        <span className="text-[10px] text-[#64748b] font-black uppercase tracking-widest group-hover:text-[#1e293b] transition-colors">Maestro Prod.</span>
                                    </button>
                                ) : (
                                    <button className="bg-slate-50/50 border border-slate-100 p-5 rounded-[1.5rem] flex flex-col items-center gap-3 text-center opacity-60 cursor-not-allowed">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100/80 text-[#94a3b8] flex items-center justify-center text-xl">
                                            <i className="bi bi-lock-fill"></i>
                                        </div>
                                        <span className="text-[10px] text-[#94a3b8] font-black uppercase tracking-widest">Maestro Prod.</span>
                                    </button>
                                )}

                                {canManageBoxes ? (
                                    <button
                                        onClick={() => router.push('/escaneo/cajas')}
                                        className="bg-white/60 backdrop-blur-sm border border-white hover:border-[#969836]/20 p-5 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all duration-300 active:scale-95 text-center group cursor-pointer shadow-sm hover:shadow-md hover:bg-white"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-[#64748b] border border-slate-200/50 group-hover:text-[#b5b74b] group-hover:border-[#b5b74b]/20 group-hover:bg-[#b5b74b]/5 flex items-center justify-center text-xl transition-all">
                                            <i className="bi bi-archive-fill"></i>
                                        </div>
                                        <span className="text-[10px] text-[#64748b] font-black uppercase tracking-widest group-hover:text-[#1e293b] transition-colors">Maestro Cajas</span>
                                    </button>
                                ) : (
                                    <button className="bg-slate-50/50 border border-slate-100 p-5 rounded-[1.5rem] flex flex-col items-center gap-3 text-center opacity-60 cursor-not-allowed">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100/80 text-[#94a3b8] flex items-center justify-center text-xl">
                                            <i className="bi bi-lock-fill"></i>
                                        </div>
                                        <span className="text-[10px] text-[#94a3b8] font-black uppercase tracking-widest">Maestro Cajas</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* BOTONES SECUNDARIOS */}
                        <div className="w-full flex flex-col gap-3 mt-4">
                            <button
                                onClick={() => router.push('/escaneo/temporal')}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/30 border border-amber-200/60 text-amber-700 font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] hover:text-amber-800 hover:border-amber-300 hover:shadow-[0_4px_15px_rgba(251,191,36,0.15)] transition-all flex items-center justify-center gap-3 cursor-pointer"
                            >
                                <span className="relative flex h-2 w-2 mr-1">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <i className="bi bi-cloud-slash text-sm"></i>
                                Sincronización Temporal
                            </button>

                            {canViewHistory ? (
                                <button
                                    onClick={() => router.push('/escaneo/historial')}
                                    className="w-full py-4 rounded-2xl bg-white/50 backdrop-blur-md border border-slate-200 text-[#475569] font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] hover:text-[#1e293b] hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer"
                                >
                                    <i className="bi bi-clock-history text-sm"></i>
                                    Registro de Historial
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="w-full py-4 rounded-2xl bg-slate-50/50 border border-slate-100 text-slate-400 font-bold text-[11px] sm:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 cursor-not-allowed"
                                >
                                    <i className="bi bi-lock-fill text-sm"></i>
                                    Historial Bloqueado
                                </button>
                            )}
                        </div>
                    </main>
                </div>
            )}



            {/* --- VISTA 3: GESTIÓN DE LOTE (POST-ESCANEO LOCAL) --- */}
            {scanMode && lastScanned && (
                <div className="flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                    <div className="p-4 sm:p-6 max-w-xl mx-auto w-full space-y-5">

                        {/* HEADER IDENTIDAD */}
                        <div className={`bg-[#ffffff] border-2 p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col gap-4 ${lastScanned.is_match ? 'border-[#e2e8f0]' : 'border-red-500/30'}`}>
                            {lastScanned.is_match && (
                                <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[60px] rounded-full z-0 ${scanMode === 'producto' ? 'bg-[#208754]/10' : 'bg-[#b5b74b]/10'}`}></div>
                            )}

                            <div className="flex items-center justify-between relative z-10">
                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${lastScanned.is_match ? 'bg-[#f1f5f9] text-[#208754] border-[#005d31]/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {lastScanned.is_match ? 'Catálogo Identificado' : 'No Registrado en BD'}
                                </span>
                                <button onClick={handleDiscard} className="text-[#64748b] hover:text-[#1e293b] px-3 py-2 bg-[#f1f5f9] rounded-xl text-[10px] font-black transition-all uppercase tracking-widest flex items-center gap-2">
                                    <i className="bi bi-trash3"></i> Descartar
                                </button>
                            </div>

                            <div className="relative z-10 mt-2">
                                <p className="text-[#94a3b8] text-[10px] font-black tracking-[0.3em] uppercase mb-1">CÓDIGO OBTENIDO</p>
                                <p className="text-2xl font-mono font-black text-[#1e293b] tracking-widest break-all mb-4">{lastScanned.barcode}</p>
                                <h3 className="text-xl font-bold text-[#1e293b] leading-tight">
                                    {lastScanned.is_match ? lastScanned.presentacion : `Elemento Desconocido`}
                                </h3>
                            </div>
                        </div>

                        {/* INPUT LOTE (OBLIGATORIO) */}
                        <div className={`p-6 sm:p-8 rounded-[2rem] transition-all duration-300 border-2 relative overflow-hidden ${loteValue.trim() ? 'bg-[#f1f5f9] border-[#969836] shadow-[0_0_40px_rgba(59,130,246,0.15)] ring-2 ring-[#969836]/10' : 'bg-[#ffffff] border-red-500/40 outline outline-4 outline-red-500/10'}`}>

                            {/* Warning Indicator */}
                            {!loteValue.trim() && (
                                <div className="absolute top-0 inset-x-0 h-1 bg-red-500 animate-pulse"></div>
                            )}

                            <div className="flex flex-col mb-4 gap-2">
                                <div className="flex items-center gap-2">
                                    <i className={`bi bi-keyboard-fill text-xl ${loteValue.trim() ? 'text-[#b5b74b]' : 'text-[#cbd5e1]'}`}></i>
                                    <label className="text-[11px] text-[#1e293b] uppercase font-black tracking-[0.2em]">
                                        Lote de Producción <span className="text-red-500">*</span>
                                    </label>
                                </div>
                                <p className="text-[#94a3b8] text-[10px] font-bold">Ingrese el código impreso en el producto físicamente.</p>
                            </div>
                            <input
                                value={loteValue}
                                onChange={(e) => setLoteValue(e.target.value)}
                                placeholder="EJM: LOT-2024..."
                                className="w-full bg-[#ffffff] p-4 rounded-2xl text-2xl sm:text-3xl font-mono text-[#1e293b] font-bold tracking-[0.1em] sm:tracking-[0.2em] outline-none placeholder:text-slate-700/50 transition-all border border-transparent focus:border-[#969836]/50 uppercase"
                                autoFocus
                            />
                        </div>

                        {/* CARDS INFORMATIVAS */}
                        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
                            {scanMode === 'producto' ? (
                                <>
                                    <InfoCard icon="bi-calendar-event" label="Vida Útil Est." value={lastScanned.is_match ? (lastScanned.vida_util || 'N/A') : 'Pdv'} colorTheme={lastScanned.is_match ? "green" : "cyan"} />
                                    <InfoCard icon="bi-aspect-ratio" label="Unidades Envase" value={lastScanned.is_match ? lastScanned.unidades_por_caja : 'Pdv'} colorTheme={lastScanned.is_match ? "purple" : "cyan"} />
                                    <InfoCard icon="bi-shield-check" label="Reg. Sanitario" value={lastScanned.is_match ? (lastScanned.registro_sanitario || 'N/A') : 'Pdv'} colorTheme={lastScanned.is_match ? "blue" : "cyan"} />
                                    <InfoCard icon="bi-upc-scan" label="Tipo Lectura" value={lastScanned.is_match ? "Catálogo" : "Externo"} colorTheme={lastScanned.is_match ? "cyan" : "cyan"} />
                                </>
                            ) : (
                                <>
                                    <InfoCard icon="bi-box-fill" label="Capacidad (Ud.)" value={lastScanned.is_match ? lastScanned.unidades_por_caja : 'Pdv'} colorTheme={lastScanned.is_match ? "blue" : "cyan"} />
                                    <InfoCard icon="bi-check-circle-fill" label="Estado Maestro" value={lastScanned.is_match ? "Activo" : "N/R"} colorTheme={lastScanned.is_match ? "cyan" : "cyan"} />
                                    <InfoCard icon="bi-arrows-fullscreen" label="Volumen Est." value="N/A" colorTheme="purple" />
                                    <InfoCard icon="bi-upc" label="Logística" value={lastScanned.is_match ? "Válida" : "N/R"} colorTheme="cyan" />
                                </>
                            )}
                        </div>

                        {/* BARRA INFERIOR GUARDAR */}
                        <div className="sticky bottom-0 mt-8 w-full p-4 sm:p-6 bg-[#f8fafc]/90 backdrop-blur-2xl border-t border-[#e2e8f0] flex justify-center z-30">
                            <button
                                onClick={saveTransaction}
                                disabled={!loteValue.trim() || isSaving}
                                className={`w-full max-w-xl py-5 sm:py-6 rounded-[2rem] font-black text-xs sm:text-sm uppercase tracking-[0.2em] px-8 transition-all flex items-center justify-center gap-3 ${!loteValue.trim() ? 'bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed opacity-80' : 'bg-[#7b7c2b] hover:bg-[#969836] shadow-[0_10px_40px_rgba(150,152,54,0.4)] text-white active:scale-95'}`}
                            >
                                {isSaving ? (
                                    <div className="flex items-center gap-3 animate-pulse">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span className="text-[#1e293b]">GUARDANDO...</span>
                                    </div>
                                ) : (
                                    <>
                                        <i className="bi bi-cloud-arrow-up-fill text-xl relative bottom-[1px]"></i>
                                        {!loteValue.trim() ? 'AÑADIR LOTE PARA GUARDAR' : 'GUARDAR TRANSACCIÓN'}
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes scan-neon { 0%, 100% { top: 0; opacity: 0; } 10%, 90% { opacity: 1; } 50% { top: 100%; opacity: 1; } }
                .animate-scan-neon { animation: scan-neon 3s infinite ease-in-out; }
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}

// --- MICROCOMPONENTES ---
function InfoCard({ icon, label, value, colorTheme }: { icon: string, label: string, value: string, colorTheme: 'green' | 'blue' | 'purple' | 'cyan' }) {
    const colors = {
        green: 'bg-[#22c55e]/10 text-[#22c55e]',
        blue: 'bg-[#eab308]/10 text-[#eab308]',
        purple: 'bg-purple-500/10 text-purple-600',
        cyan: 'bg-cyan-500/10 text-cyan-600',
    };
    return (
        <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl flex items-center gap-4 transition-all hover:border-[#cbd5e1] shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[colorTheme]}`}>
                <i className={`bi ${icon} text-lg`}></i>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest leading-none mb-1 truncate">{label}</p>
                <p className="font-black text-[#1e293b] text-xs sm:text-sm truncate leading-none">{value}</p>
            </div>
        </div>
    );
}
