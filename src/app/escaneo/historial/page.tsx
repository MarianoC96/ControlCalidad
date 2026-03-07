'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function HistorialPage() {
    const [activeTab, setActiveTab] = useState<'productos' | 'cajas'>('productos');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [historialList, setHistorialList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        const fetchHistorial = async () => {
            setIsLoading(true);
            try {
                // TODO: Reemplazar con llamadas reales a las nuevas tablas `historial_escaneos_productos` / `cajas`
                // Por ahora usamos un mock interactivo para simular el diseño
                setTimeout(() => {
                    const mockData = activeTab === 'productos' ? [
                        { id: 1, barcode: '7751234567890', nombre: 'Aceituna Verde 200g', lote: 'L-2024-001', fecha: '2023-10-25T14:30:00Z', operador: 'Juan P.' },
                        { id: 2, barcode: '7750987654321', nombre: 'Aceite de Oliva Extra Virgen', lote: 'AOV-055', fecha: '2023-10-25T15:15:00Z', operador: 'Juan P.' },
                        { id: 3, barcode: '7751122334455', nombre: 'Aceituna Negra Deshuesada', lote: 'L-2024-002', fecha: '2023-10-26T09:00:00Z', operador: 'María L.' },
                    ] : [
                        { id: 1, barcode: 'CAJ-998877', tipo: 'Caja Master Cartón', lote: 'EMP-A1', fecha: '2023-10-25T16:00:00Z', operador: 'Carlos D.' },
                        { id: 2, barcode: 'CAJ-665544', tipo: 'Pack Termoencogible x6', lote: 'EMP-B2', fecha: '2023-10-26T10:30:00Z', operador: 'Carlos D.' },
                    ];
                    setHistorialList(mockData);
                    setIsLoading(false);
                }, 800);
            } catch (error) {
                console.error("Error fetching historial", error);
                setIsLoading(false);
            }
        };

        fetchHistorial();
    }, [activeTab]); // Refetch when tab changes

    const filteredList = historialList.filter(item => {
        const matchSearch = item.lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.barcode.includes(searchTerm) ||
            (item.nombre || item.tipo).toLowerCase().includes(searchTerm.toLowerCase());

        const matchDate = dateFilter ? item.fecha.startsWith(dateFilter) : true;

        return matchSearch && matchDate;
    });

    return (
        <div className="min-h-screen bg-slate-950 p-4 sm:p-8 lg:pl-[calc(var(--sidebar-width)+2rem)] text-white">
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase text-white mb-2">Historial de Operaciones</h1>
                        <p className="text-slate-400 font-medium">Registro cronológico de trazabilidad de planta.</p>
                    </div>
                    <div className="bg-slate-900 border border-white/10 p-1 rounded-xl flex shadow-lg">
                        <button
                            onClick={() => setActiveTab('productos')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'productos' ? 'bg-green-600/20 text-green-400 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                        >
                            Productos
                        </button>
                        <button
                            onClick={() => setActiveTab('cajas')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'cajas' ? 'bg-blue-600/20 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                        >
                            Cajas
                        </button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="bi bi-search text-slate-500"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por lote, código o nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:border-blue-500 outline-none transition-all shadow-inner"
                        />
                    </div>
                    <div className="relative w-full sm:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="bi bi-calendar-event text-slate-500"></i>
                        </div>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full sm:w-auto pl-11 pr-4 py-3 bg-slate-900 border border-white/10 rounded-2xl text-white outline-none cursor-pointer focus:border-blue-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                        />
                    </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-widest px-2">
                    <span>{filteredList.length} Resultados encontrados</span>
                    {dateFilter && <button onClick={() => setDateFilter('')} className="text-red-400 hover:text-red-300">Limpiar Fecha</button>}
                </div>

                {/* Tabla/Listado */}
                <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                            <div className={`w-12 h-12 border-4 border-slate-800 border-t-${activeTab === 'productos' ? 'green' : 'blue'}-500 rounded-full animate-spin`}></div>
                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Cargando registros...</p>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600">
                                <i className="bi bi-inbox text-3xl"></i>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg mb-1">No hay registros</h3>
                                <p className="text-slate-500 text-sm">Prueba ajustando los filtros de búsqueda o fecha.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 bg-slate-950/50">
                                        <th className="p-4 text-xs font-black tracking-widest uppercase text-slate-500">Lote Asignado</th>
                                        <th className="p-4 text-xs font-black tracking-widest uppercase text-slate-500">Documento / Tipo</th>
                                        <th className="p-4 text-xs font-black tracking-widest uppercase text-slate-500 sm:table-cell hidden">Código Barras</th>
                                        <th className="p-4 text-xs font-black tracking-widest uppercase text-slate-500">Fecha / Hora</th>
                                        <th className="p-4 text-xs font-black tracking-widest uppercase text-slate-500 lg:table-cell hidden">Operador</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredList.map((item) => (
                                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'productos' ? 'bg-green-500' : 'bg-blue-500'} group-hover:scale-150 transition-transform`}></div>
                                                    <span className="font-mono font-bold text-white text-base tracking-wider">{item.lote}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-bold text-slate-200">{activeTab === 'productos' ? item.nombre : item.tipo}</p>
                                            </td>
                                            <td className="p-4 sm:table-cell hidden">
                                                <span className="text-slate-400 font-mono text-sm tracking-widest">{item.barcode}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm">
                                                    <p className="text-slate-300 font-medium">{new Date(item.fecha).toLocaleDateString()}</p>
                                                    <p className="text-slate-500 text-xs">{new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </td>
                                            <td className="p-4 lg:table-cell hidden">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                        {item.operador.charAt(0)}
                                                    </div>
                                                    <span className="text-sm text-slate-400">{item.operador}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
