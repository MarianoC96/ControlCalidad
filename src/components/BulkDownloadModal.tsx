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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h5 className="mb-0 fw-bold">Descarga Masiva</h5>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    {error && <div className="alert alert-danger text-danger mb-3 p-2 bg-light border-danger border rounded">{error}</div>}

                    {/* Quick Filters */}
                    <div className="mb-3 d-flex gap-2 justify-content-center">
                        <button
                            type="button"
                            className={`btn btn-sm ${quickOption === 'today' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => handleQuickOption('today')}
                        >
                            Hoy
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${quickOption === 'last7' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => handleQuickOption('last7')}
                        >
                            Últimos 7 días
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${quickOption === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => handleQuickOption('month')}
                        >
                            Mes
                        </button>
                    </div>

                    {/* Month/Year Selector */}
                    {quickOption === 'month' && (
                        <div className="mb-3 row g-2">
                            <div className="col-8">
                                <select
                                    className="form-select w-100 p-2 border rounded"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-4">
                                <input
                                    type="number"
                                    className="form-control w-100 p-2 border rounded"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    min="2020"
                                    max="2100"
                                />
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label d-block mb-1 fw-semibold">Fecha Inicio</label>
                            <input
                                type="date"
                                className="form-control w-100 p-2 border rounded"
                                value={startDate}
                                onChange={e => handleManualChange('start', e.target.value)}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label className="form-label d-block mb-1 fw-semibold">Fecha Fin</label>
                            <input
                                type="date"
                                className="form-control w-100 p-2 border rounded"
                                value={endDate}
                                onChange={e => handleManualChange('end', e.target.value)}
                                required
                            />
                        </div>
                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ marginRight: '10px' }}>Cancelar</button>
                            <button type="submit" className="btn btn-primary bg-primary text-white" disabled={loading}>
                                {loading ? 'Solicitando...' : 'Iniciar Descarga'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <style jsx>{`
                 .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1050;
                }
                .modal-content {
                    background: white; border-radius: 8px; width: 100%;
                }
                .modal-header {
                    padding: 1rem; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;
                }
                .modal-body { padding: 1.5rem; }
                .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
                .btn { padding: 0.5rem 1rem; border-radius: 0.25rem; border: none; cursor: pointer; }
                .btn-sm { font-size: 0.875rem; padding: 0.25rem 0.5rem; margin-right: 5px; border: 1px solid transparent; }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-outline-secondary { background: white; color: #6c757d; border-color: #6c757d; }
                .btn-primary { background: #0d6efd; color: white; border-color: #0d6efd; }
                .btn:disabled { opacity: 0.7; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
