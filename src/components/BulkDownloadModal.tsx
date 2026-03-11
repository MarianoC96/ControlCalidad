'use client';
import { useState, useEffect } from 'react';
import { getPeruDateString } from '@/lib/utils';

interface BulkDownloadModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

type QuickOption = 'custom' | 'today' | 'last7' | 'month';

export default function BulkDownloadModal({ onClose, onSuccess }: BulkDownloadModalProps) {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Quick filter states
    const [quickOption, setQuickOption] = useState<QuickOption>('custom');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const handleQuickOption = (option: QuickOption) => {
        setQuickOption(option);
        const today = new Date(); // Local machine time

        if (option === 'today') {
            const str = getPeruDateString(today);
            setStartDate(str);
            setEndDate(str);
        } else if (option === 'last7') {
            const endStr = getPeruDateString(today);

            // Calculate 7 days ago based on Peru Time (approximate for display logic, but precise for calculation)
            const daysAgo = new Date(today);
            daysAgo.setDate(today.getDate() - 7);
            const startStr = getPeruDateString(daysAgo);

            setStartDate(startStr);
            setEndDate(endStr);
        } else if (option === 'month') {
            updateMonthDates(selectedMonth, selectedYear);
        }
    };

    const updateMonthDates = (month: number, year: number) => {
        // Construct date at midday to avoid edge case jumps when subtracting timezone
        const firstDay = new Date(year, month, 1, 12, 0, 0);
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0);

        setStartDate(getPeruDateString(firstDay));
        setEndDate(getPeruDateString(lastDay));
    };

    // When month/year changes
    useEffect(() => {
        if (quickOption === 'month') {
            updateMonthDates(selectedMonth, selectedYear);
        }
    }, [selectedMonth, selectedYear, quickOption]);

    const handleManualChange = (field: 'start' | 'end', value: string) => {
        if (field === 'start') setStartDate(value);
        else setEndDate(value);
        setQuickOption('custom');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Create Request
            const res = await fetch('/api/downloads/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate, endDate })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error creating request');

            // 2. Trigger Process (Fire and Forget)
            fetch('/api/downloads/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ downloadId: data.id })
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#f8fafc] rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-lg max-h-[90vh]" style={{ zIndex: 10 }}>
                
                {/* Header */}
                <div className="p-6 sm:p-8 bg-white flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-[2.5rem]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 border border-blue-100">
                            <i className="bi bi-cloud-arrow-down-fill"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Descarga Masiva</h3>
                            <p className="text-[#64748b] text-[10px] font-bold uppercase tracking-widest mt-1 m-0">Generar archivos ZIP por fecha</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all border-0 shadow-sm active:scale-90">
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                <div className="p-6 sm:p-8 overflow-y-auto flex-grow custom-scrollbar space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold uppercase tracking-tight flex items-center gap-3">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            {error}
                        </div>
                    )}

                    {/* Quick Filters */}
                    <div className="bg-white p-2 rounded-2xl border border-[#e2e8f0] shadow-sm flex gap-2">
                        <button
                            type="button"
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${quickOption === 'today' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-[#64748b] hover:bg-slate-50'}`}
                            onClick={() => handleQuickOption('today')}
                        >
                            Hoy
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${quickOption === 'last7' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-[#64748b] hover:bg-slate-50'}`}
                            onClick={() => handleQuickOption('last7')}
                        >
                            7 Días
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${quickOption === 'month' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-[#64748b] hover:bg-slate-50'}`}
                            onClick={() => handleQuickOption('month')}
                        >
                            Mes
                        </button>
                    </div>

                    {/* Month/Year Selector */}
                    {quickOption === 'month' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Mes</label>
                                <select
                                    className="w-full bg-white border border-[#cbd5e1] rounded-2xl p-4 text-[#1e293b] font-medium outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Año</label>
                                <input
                                    type="number"
                                    className="w-full bg-white border border-[#cbd5e1] rounded-2xl p-4 text-[#1e293b] font-bold outline-none focus:border-blue-500 transition-all"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    min="2020"
                                    max="2100"
                                />
                            </div>
                        </div>
                    )}

                    {/* Custom Range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-6 rounded-[2rem] border border-[#e2e8f0] shadow-sm">
                        <div className="space-y-2">
                            <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1 flex items-center gap-2">
                                <i className="bi bi-calendar-event text-blue-500"></i> Inicio
                            </label>
                            <input
                                type="date"
                                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl p-4 text-[#1e293b] font-bold outline-none focus:border-blue-500 transition-all"
                                value={startDate}
                                onChange={e => handleManualChange('start', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1 flex items-center gap-2">
                                <i className="bi bi-calendar-check text-blue-500"></i> Fin
                            </label>
                            <input
                                type="date"
                                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-2xl p-4 text-[#1e293b] font-bold outline-none focus:border-blue-500 transition-all"
                                value={endDate}
                                onChange={e => handleManualChange('end', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <i className="bi bi-info-circle-fill"></i>
                        </div>
                        <p className="text-[11px] text-[#1e293b] font-medium leading-relaxed m-0">
                            La descarga se procesará en segundo plano. Podrás ver el progreso y descargar el archivo final desde la pestaña <b>Historial de Descargas</b>.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 sm:p-8 bg-white border-t border-[#e2e8f0] flex justify-end gap-4 flex-shrink-0 rounded-b-[2.5rem]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.15em] text-[#64748b] bg-[#f8fafc] hover:bg-[#f1f5f9] transition-all border-0 active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !startDate || !endDate}
                        className="px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.15em] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 border-0 active:scale-95"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-cloud-download"></i>
                                Solicitar Descarga
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
