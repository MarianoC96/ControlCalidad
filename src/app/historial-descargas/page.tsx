'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import DownloadHistory from '@/components/DownloadHistory';
import BulkDownloadModal from '@/components/BulkDownloadModal';
import { useRouter } from 'next/navigation';

export default function HistorialDescargasPage() {
    const router = useRouter();
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [loading, setLoading] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    // Key to trigger refresh in DownloadHistory if needed (though it polls, so might not be strictly necessary, 
    // but good for immediate feedback)
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (!response.ok) {
                    router.push('/');
                    return;
                }
                const user = await response.json();
                setUserName(user.nombre_completo);
                setUserRole(user.roles);
            } catch (error) {
                console.error('Error checking auth:', error);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    if (loading) {
        return (
            <div className="container mt-4 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <main className="main-content">
                {/* Header Premium */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system"><span className="dot-pulse"></span>EXPORTACIÓN DE DATOS</div>
                        <h1 className="title">Descargas Masivas</h1>
                        <p className="subtitle">Descargue lotes de registros en formato Excel para su análisis.</p>
                    </div>
                    <div className="header-stats">
                        <button className="btn-add-premium shadow-sm" onClick={() => setIsDownloadModalOpen(true)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                <path fillRule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z" />
                                <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                            </svg>
                            <span>Nueva Descarga</span>
                        </button>
                    </div>
                </div>

                <DownloadHistory key={refreshKey} />

                {isDownloadModalOpen && (
                    <BulkDownloadModal
                        onClose={() => setIsDownloadModalOpen(false)}
                        onSuccess={() => {
                            // Force refresh of history component
                            setRefreshKey(prev => prev + 1);
                        }}
                    />
                )}
            </main>

            <style jsx>{`
                .page-wrapper {
                    min-height: 100vh;
                    background-color: #f8fafc;
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .main-content {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }

                /* Header Premium */
                .header-container {
                    background: white;
                    border-radius: 24px;
                    padding: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .badge-system {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #2563eb;
                    font-weight: 800;
                    font-size: 0.7rem;
                    margin-bottom: 10px;
                }
                .dot-pulse {
                    width: 8px;
                    height: 8px;
                    background: #2563eb;
                    border-radius: 50%;
                    animation: pulse-dot 2s infinite;
                }
                @keyframes pulse-dot {
                    0% { box-shadow: 0 0 0 0 rgba(3,105,161,0.4); }
                    70% { box-shadow: 0 0 0 6px rgba(3,105,161,0); }
                    100% { box-shadow: 0 0 0 0 rgba(3,105,161,0); }
                }
                .title {
                    font-size: 1.6rem;
                    font-weight: 900;
                    color: #1e293b;
                    margin: 0;
                }
                .subtitle {
                    color: #64748b;
                    font-size: 0.9rem;
                    margin: 5px 0 0 0;
                }
                .header-stats {
                    display: flex;
                    gap: 15px;
                    align-items: center;
                }
                .btn-add-premium {
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                }
                .btn-add-premium:hover {
                    transform: translateY(-2px);
                    background: #059669;
                    box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
                }

                @media (max-width: 768px) {
                    .header-container {
                        flex-direction: column;
                        text-align: center;
                        gap: 20px;
                    }
                    .header-stats {
                        flex-direction: column;
                        width: 100%;
                    }
                    .btn-add-premium {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    );
}
