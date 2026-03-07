'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { createClient } from '@/lib/supabase/client';

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
    // --- ESTADOS PRINCIPALES ---
    const [scanModeState, setScanModeState] = useState<'producto' | 'caja' | null>(null);
    const scanModeRef = useRef<'producto' | 'caja' | null>(null);
    const scanMode = scanModeState;

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
    const supabase = createClient();

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
            const table = currentMode === 'producto' ? 'productos_barcode' : 'cajas_barcode';
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('barcode', barcode)
                .single();

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
    }, [supabase]);

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
        try {
            // Lógica pendiente de Supabase - simulación de delay de red temporal
            await new Promise(resolve => setTimeout(resolve, 800));
            // Ej: await supabase.from(`historial_escaneos_${scanMode}s`).insert({ ... });

            // Transición post-guardado
            setLastScanned(null);
            setLoteValue('');
            setScanMode(null);
            alert('Transacción guardada exitosamente.');
        } catch (error) {
            console.error(error);
            alert('Error guardando la transacción.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col pl-0 lg:pl-[--sidebar-width] transition-all overflow-x-hidden pb-32">

            {/* --- MODAL DE CÁMARA --- */}
            {showScannerModal && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-8 animate-in fade-in zoom-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl" onClick={() => { stopScanner(); setScanMode(null); }}></div>

                    <div className="relative w-full max-w-xl aspect-[4/5] bg-slate-900 rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col">
                        <div className="p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${scanMode === 'producto' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    <i className={`bi ${scanMode === 'producto' ? 'bi-upc-scan' : 'bi-box-seam'} text-2xl`}></i>
                                </div>
                                <div>
                                    <h4 className="text-white font-black text-sm uppercase tracking-tighter">
                                        Escaneo de {scanMode}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enfoca el código QR / EAN</p>
                                </div>
                            </div>
                            <button onClick={() => { stopScanner(); setScanMode(null); }} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-transform active:scale-90"><i className="bi bi-x-lg text-lg"></i></button>
                        </div>

                        <div className="flex-1 relative bg-black">
                            <div id="reader" className="w-full h-full"></div>
                            {!isInitializing && !error && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12">
                                    <div className={`w-full max-w-sm aspect-[1.8/1] border-2 rounded-3xl relative overflow-hidden transition-all duration-500 border-dashed ${scanMode === 'producto' ? 'border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.2)]' : 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)]'}`}>
                                        <div className={`absolute left-0 right-0 h-1 transition-all animate-scan-neon ${scanMode === 'producto' ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                                    </div>
                                </div>
                            )}
                            {isInitializing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 transition-all">
                                    <div className={`w-14 h-14 border-4 border-white/5 rounded-full animate-spin ${scanMode === 'producto' ? 'border-t-green-500' : 'border-t-blue-500'}`}></div>
                                    <p className="text-slate-500 mt-6 text-[10px] font-black tracking-[0.3em] uppercase">Sensor</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOP NAV HEADER --- */}
            <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-2xl h-[72px]">
                {scanMode ? (
                    <div className="flex items-center gap-4 cursor-pointer" onClick={handleBackToModules}>
                        <div className="w-10 h-10 bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center hover:text-white transition-all">
                            <i className="bi bi-arrow-left"></i>
                        </div>
                        <div>
                            <h1 className="text-white font-black tracking-tighter text-sm leading-none uppercase">Módulo {scanMode}s</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Control Individual</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-lg border border-white/5">
                            <i className="bi bi-qr-code text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-white font-black tracking-tighter text-base leading-none">EL OLIVAR</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Escáner Logístico</p>
                        </div>
                    </div>
                )}
            </header>

            {/* --- VISTA 1: MENÚ DE MÓDULOS --- */}
            {!scanMode && (
                <main className="flex-1 flex flex-col p-6 items-center justify-center gap-6 animate-in fade-in zoom-in-95 duration-500 max-w-lg mx-auto w-full">
                    <div className="text-center mb-6">
                        <i className="bi bi-command text-5xl text-slate-600 mb-6 inline-block"></i>
                        <h2 className="text-white text-3xl font-black uppercase tracking-tight">Menú Principal</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Seleccione el proceso a realizar en planta.</p>
                    </div>

                    <button
                        onClick={() => startScanner('producto')}
                        className="w-full bg-slate-900 border border-green-500/20 hover:border-green-500/50 p-6 rounded-[2.5rem] flex items-center gap-6 group transition-all active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                    >
                        <div className="w-16 h-16 rounded-[1.5rem] bg-green-500/10 text-green-400 flex items-center justify-center text-3xl group-hover:bg-green-500 group-hover:text-white transition-all shadow-inner">
                            <i className="bi bi-box-seam-fill relative top-[2px]"></i>
                        </div>
                        <div className="text-left flex-1">
                            <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1">Productos</h3>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Escanear ítems y lotes</p>
                        </div>
                        <i className="bi bi-chevron-right text-slate-600 group-hover:text-green-500 group-hover:translate-x-1 transition-all text-xl"></i>
                    </button>

                    <button
                        onClick={() => startScanner('caja')}
                        className="w-full bg-slate-900 border border-blue-500/20 hover:border-blue-500/50 p-6 rounded-[2.5rem] flex items-center gap-6 group transition-all active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                    >
                        <div className="w-16 h-16 rounded-[1.5rem] bg-blue-500/10 text-blue-400 flex items-center justify-center text-3xl group-hover:bg-blue-500 group-hover:text-white transition-all shadow-inner">
                            <i className="bi bi-box-fill relative top-[2px]"></i>
                        </div>
                        <div className="text-left flex-1">
                            <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1">Cajas</h3>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Escanear empaques</p>
                        </div>
                        <i className="bi bi-chevron-right text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all text-xl"></i>
                    </button>
                </main>
            )}



            {/* --- VISTA 3: GESTIÓN DE LOTE (POST-ESCANEO LOCAL) --- */}
            {scanMode && lastScanned && (
                <div className="flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                    <div className="p-4 sm:p-6 max-w-xl mx-auto w-full space-y-5">

                        {/* HEADER IDENTIDAD */}
                        <div className={`bg-slate-900 border-2 p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col gap-4 ${lastScanned.is_match ? 'border-slate-800' : 'border-red-500/30'}`}>
                            {lastScanned.is_match && (
                                <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[60px] rounded-full z-0 ${scanMode === 'producto' ? 'bg-green-500/10' : 'bg-blue-500/10'}`}></div>
                            )}

                            <div className="flex items-center justify-between relative z-10">
                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${lastScanned.is_match ? 'bg-slate-800 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {lastScanned.is_match ? 'Catálogo Identificado' : 'No Registrado en BD'}
                                </span>
                                <button onClick={handleDiscard} className="text-slate-400 hover:text-white px-3 py-2 bg-slate-800 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest flex items-center gap-2">
                                    <i className="bi bi-trash3"></i> Descartar
                                </button>
                            </div>

                            <div className="relative z-10 mt-2">
                                <p className="text-slate-500 text-[10px] font-black tracking-[0.3em] uppercase mb-1">CÓDIGO OBTENIDO</p>
                                <p className="text-2xl font-mono font-black text-white tracking-widest break-all mb-4">{lastScanned.barcode}</p>
                                <h3 className="text-xl font-bold text-white leading-tight">
                                    {lastScanned.is_match ? lastScanned.presentacion : `Elemento Desconocido`}
                                </h3>
                            </div>
                        </div>

                        {/* INPUT LOTE (OBLIGATORIO) */}
                        <div className={`p-6 sm:p-8 rounded-[2rem] transition-all duration-300 border-2 relative overflow-hidden ${loteValue.trim() ? 'bg-slate-800 border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.15)] ring-4 ring-blue-500/10' : 'bg-slate-900 border-red-500/40 outline outline-4 outline-red-500/10'}`}>

                            {/* Warning Indicator */}
                            {!loteValue.trim() && (
                                <div className="absolute top-0 inset-x-0 h-1 bg-red-500 animate-pulse"></div>
                            )}

                            <div className="flex flex-col mb-4 gap-2">
                                <div className="flex items-center gap-2">
                                    <i className={`bi bi-keyboard-fill text-xl ${loteValue.trim() ? 'text-blue-400' : 'text-slate-600'}`}></i>
                                    <label className="text-[11px] text-white uppercase font-black tracking-[0.2em]">
                                        Lote de Producción <span className="text-red-500">*</span>
                                    </label>
                                </div>
                                <p className="text-slate-500 text-[10px] font-bold">Ingrese el código impreso en el producto físicamente.</p>
                            </div>
                            <input
                                value={loteValue}
                                onChange={(e) => setLoteValue(e.target.value)}
                                placeholder="EJM: LOT-2024..."
                                className="w-full bg-slate-950/50 p-4 rounded-2xl text-2xl sm:text-3xl font-mono text-white font-bold tracking-[0.1em] sm:tracking-[0.2em] outline-none placeholder:text-slate-700/50 transition-all border border-transparent focus:border-blue-500/50 uppercase"
                                autoFocus
                            />
                        </div>

                        {/* CARDS INFORMATIVAS */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                            {scanMode === 'producto' ? (
                                <>
                                    <InfoCard icon="bi-calendar-event" label="Vida Útil Est." value={lastScanned.is_match ? (lastScanned.vida_util || 'N/A') : 'Desconocido'} colorTheme={lastScanned.is_match ? "green" : "cyan"} />
                                    <InfoCard icon="bi-aspect-ratio" label="Unidades Envase" value={lastScanned.is_match ? lastScanned.unidades_por_caja : 'Desconocido'} colorTheme={lastScanned.is_match ? "purple" : "cyan"} />
                                    <InfoCard icon="bi-shield-check" label="Reg. Sanitario" value={lastScanned.is_match ? (lastScanned.registro_sanitario || 'N/A') : 'No Verificado'} colorTheme={lastScanned.is_match ? "blue" : "cyan"} />
                                    <InfoCard icon="bi-upc-scan" label="Tipo de Lectura" value={lastScanned.is_match ? "Catálogo Interno" : "No Registrado"} colorTheme={lastScanned.is_match ? "cyan" : "cyan"} />
                                </>
                            ) : (
                                <>
                                    <InfoCard icon="bi-box-fill" label="Capacidad (Ud.)" value={lastScanned.is_match ? lastScanned.unidades_por_caja : 'Desconocido'} colorTheme={lastScanned.is_match ? "blue" : "cyan"} />
                                    <InfoCard icon="bi-check-circle-fill" label="Estado" value={lastScanned.is_match ? "Listado Activo" : "No Registrado"} colorTheme={lastScanned.is_match ? "cyan" : "cyan"} />
                                    <InfoCard icon="bi-arrows-fullscreen" label="Volumen Est." value="N/A" colorTheme="purple" />
                                    <InfoCard icon="bi-upc" label="Tipo de Lectura" value={lastScanned.is_match ? "U. Logística" : "Desconocida"} colorTheme="cyan" />
                                </>
                            )}
                        </div>

                        {/* BARRA INFERIOR GUARDAR */}
                        <div className="sticky bottom-0 mt-8 w-full p-4 sm:p-6 bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 flex justify-center z-30">
                            <button
                                onClick={saveTransaction}
                                disabled={!loteValue.trim() || isSaving}
                                className={`w-full max-w-xl py-5 sm:py-6 rounded-[2rem] font-black text-xs sm:text-sm uppercase tracking-[0.2em] px-8 transition-all flex items-center justify-center gap-3 ${!loteValue.trim() ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-80' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_10px_40px_rgba(37,99,235,0.4)] text-white active:scale-95'}`}
                            >
                                {isSaving ? (
                                    <div className="flex items-center gap-3 animate-pulse">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span className="text-white">GUARDANDO...</span>
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
            `}</style>
        </div>
    );
}

// --- MICROCOMPONENTES ---
function InfoCard({ icon, label, value, colorTheme }: { icon: string, label: string, value: string, colorTheme: 'green' | 'blue' | 'purple' | 'cyan' }) {
    const colors = {
        green: 'bg-green-500/10 text-green-400',
        blue: 'bg-blue-500/10 text-blue-400',
        purple: 'bg-purple-500/10 text-purple-400',
        cyan: 'bg-cyan-500/10 text-cyan-400',
    };
    return (
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl flex items-center justify-center gap-4 hover:bg-slate-800/80 transition-all flex-col sm:flex-row text-center sm:text-left shadow-lg">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[colorTheme]}`}>
                <i className={`bi ${icon} text-lg`}></i>
            </div>
            <div className="min-w-0">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1 sm:mb-0.5 truncate">{label}</p>
                <p className="font-black text-white text-sm truncate">{value}</p>
            </div>
        </div>
    );
}
