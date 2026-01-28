'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { Registro, Control, Foto } from '@/lib/supabase/types';

import { generateRegistroPDF } from '@/lib/pdf-generator';

interface RegistroWithDetails extends Registro {
    controles?: Control[];
    fotos?: Foto[];
}

export default function RegistrosClient() {
    const router = useRouter();
    const supabase = createClient();

    const [registros, setRegistros] = useState<RegistroWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [selectedRegistro, setSelectedRegistro] = useState<RegistroWithDetails | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    useEffect(() => {
        checkAuth();
        loadRegistros();
    }, []);

    const checkAuth = async () => {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            router.push('/');
            return;
        }
        const user = await response.json();
        setUserName(user.nombre_completo);
        setUserRole(user.roles);
    };

    const loadRegistros = async () => {
        try {
            // Use internal API to bypass RLS
            const response = await fetch('/api/registros');
            if (!response.ok) throw new Error('Error fetching registros');
            const data = await response.json();
            setRegistros(data || []);
        } catch (err) {
            console.error('Error loading registros:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetails = async (registroId: number) => {
        const response = await fetch(`/api/registros/detalles?id=${registroId}`);
        if (!response.ok) return { controles: [], fotos: [] };
        return await response.json();
    };

    const viewDetails = async (registro: Registro) => {
        const { controles, fotos } = await fetchDetails(registro.id);

        setSelectedRegistro({
            ...registro,
            controles,
            fotos,
        });
    };

    const handleDownloadPDF = async (registro: Registro) => {
        try {
            setDownloadingId(registro.id);

            // If we already have the details loaded (e.g. from modal), use them
            let controles = [];
            let fotos = [];

            if (selectedRegistro && selectedRegistro.id === registro.id) {
                controles = selectedRegistro.controles || [];
                fotos = selectedRegistro.fotos || [];
            } else {
                // Otherwise fetch them
                const details = await fetchDetails(registro.id);
                controles = details.controles;
                fotos = details.fotos;
            }

            const registroCompleto = {
                ...registro,
                controles,
                fotos
            };

            generateRegistroPDF(registroCompleto);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF. Por favor intente nuevamente.');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    if (loading) {
        return (
            <>
                <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />
                <div className="container mt-4">
                    <div className="text-center">
                        <div className="spinner"></div>
                        <p>Cargando...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <div className="container mt-4">
                <h2 className="text-center mb-4">Registros de Control de Calidad</h2>

                {registros.length === 0 ? (
                    <div className="empty-state">
                        <p>No hay registros disponibles</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Lote Interno</th>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Verificado por</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registros.map((registro) => (
                                    <tr key={registro.id}>
                                        <td>{formatDate(registro.fecha_registro)}</td>
                                        <td>{registro.lote_interno}</td>
                                        <td>{registro.producto_nombre}</td>
                                        <td>{registro.cantidad}</td>
                                        <td>{registro.verificado_por || registro.usuario_nombre}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => viewDetails(registro)}
                                                >
                                                    Ver Detalles
                                                </button>
                                                <button
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={() => handleDownloadPDF(registro)}
                                                    disabled={downloadingId === registro.id}
                                                >
                                                    {downloadingId === registro.id ? '...' : 'PDF'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedRegistro && (
                <div className="modal-overlay" onClick={() => setSelectedRegistro(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Detalle del Registro</h3>
                            <button className="close-btn" onClick={() => setSelectedRegistro(null)}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <strong>Lote Interno:</strong>
                                    <span>{selectedRegistro.lote_interno}</span>
                                </div>
                                <div className="detail-item">
                                    <strong>Guía:</strong>
                                    <span>{selectedRegistro.guia || '-'}</span>
                                </div>
                                <div className="detail-item">
                                    <strong>Producto:</strong>
                                    <span>{selectedRegistro.producto_nombre}</span>
                                </div>
                                <div className="detail-item">
                                    <strong>Cantidad:</strong>
                                    <span>{selectedRegistro.cantidad}</span>
                                </div>
                                <div className="detail-item">
                                    <strong>Fecha:</strong>
                                    <span>{formatDate(selectedRegistro.fecha_registro)}</span>
                                </div>
                                <div className="detail-item">
                                    <strong>Verificado por:</strong>
                                    <span>{selectedRegistro.verificado_por || selectedRegistro.usuario_nombre}</span>
                                </div>
                            </div>

                            {selectedRegistro.observaciones_generales && (
                                <div className="observations">
                                    <strong>Observaciones Generales:</strong>
                                    <p>{selectedRegistro.observaciones_generales}</p>
                                </div>
                            )}

                            {selectedRegistro.controles && selectedRegistro.controles.length > 0 && (
                                <>
                                    <h4>Controles</h4>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Parámetro</th>
                                                <th>Rango</th>
                                                <th>Valor</th>
                                                <th>Estado</th>
                                                <th>Observación</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRegistro.controles.map((control) => (
                                                <tr key={control.id}>
                                                    <td>{control.parametro_nombre}</td>
                                                    <td>{control.rango_completo}</td>
                                                    <td>
                                                        {control.valor_control !== null
                                                            ? control.valor_control
                                                            : control.texto_control || '-'}
                                                    </td>
                                                    <td>
                                                        {control.fuera_de_rango ? (
                                                            <span className="badge badge-danger">Fuera de Rango</span>
                                                        ) : (
                                                            <span className="badge badge-success">OK</span>
                                                        )}
                                                    </td>
                                                    <td>{control.observacion || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}

                            {selectedRegistro.fotos && selectedRegistro.fotos.length > 0 && (
                                <>
                                    <h4>Fotos</h4>
                                    <div className="photos-grid">
                                        {selectedRegistro.fotos.map((foto) => (
                                            <div key={foto.id} className="photo-item">
                                                <img
                                                    src={foto.datos_base64}
                                                    alt={foto.descripcion || `Foto ${foto.id}`}
                                                    className="photo-preview"
                                                />
                                                {foto.descripcion && <span>{foto.descripcion}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-success"
                                onClick={() => handleDownloadPDF(selectedRegistro)}
                                disabled={downloadingId === selectedRegistro.id}
                            >
                                {downloadingId === selectedRegistro.id ? 'Generando...' : 'Descargar PDF Reporte'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setSelectedRegistro(null)}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #6c757d;
        }

        .table-container {
          overflow-x: auto;
        }

        .action-buttons {
            display: flex;
            gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.875rem;
        }

        .btn-outline-secondary {
            border: 1px solid #6c757d;
            background: white;
            color: #6c757d;
        }
        
        .btn-outline-secondary:hover {
            background: #6c757d;
            color: white;
        }

        .btn-success {
            background-color: #28a745;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.25rem;
            cursor: pointer;
        }
        
        .btn-success:hover {
            background-color: #218838;
        }
        
        .btn-success:disabled {
            background-color: #94d3a2;
            cursor: not-allowed;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 0.5rem;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #dee2e6;
        }

        .modal-header h3 {
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6c757d;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid #dee2e6;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-item strong {
          color: #6c757d;
          font-size: 0.875rem;
        }

        .observations {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 0.25rem;
        }

        .observations p {
          margin: 0.5rem 0 0 0;
        }

        h4 {
          margin: 1.5rem 0 1rem 0;
          color: #333;
        }

        .photos-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .photo-item {
          background: #e9ecef;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </>
    );
}
