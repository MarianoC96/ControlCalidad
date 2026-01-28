'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';

export default function PerfilPage() {
    const router = useRouter();
    const supabase = createClient();

    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [userEmail, setUserEmail] = useState('');
    const [userLogin, setUserLogin] = useState('');
    const [loading, setLoading] = useState(true);

    // Estados para cambio de contraseña
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        checkAuth();
    }, []);

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
            setUserEmail(user.email);
            setUserLogin(user.usuario);
        } catch (error) {
            console.error('Error checking auth:', error);
            router.push('/');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ text: 'Las contraseñas no coinciden', type: 'error' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ text: 'La contraseña debe tener al menos 6 caracteres', type: 'error' });
            return;
        }

        setMessage({ text: 'Funcionalidad de cambio de contraseña en construcción', type: 'info' });
        // Aquí iría la llamada a la API para cambiar password
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando perfil...</p>
                <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #607d8b;
          }
          .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #607d8b;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 1rem;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        );
    }

    return (
        <>
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <div className="container mt-4">
                <div className="profile-card">
                    <div className="profile-header">
                        <div className="avatar-circle">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <h2>{userName}</h2>
                        <span className="role-badge">{userRole}</span>
                    </div>

                    <div className="profile-body">
                        <div className="info-section">
                            <h3>Información Personal</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Nombre de Usuario</label>
                                    <p>{userLogin}</p>
                                </div>
                                <div className="info-item">
                                    <label>Correo Electrónico</label>
                                    <p>{userEmail}</p>
                                </div>
                                <div className="info-item">
                                    <label>Rol asignado</label>
                                    <p style={{ textTransform: 'capitalize' }}>{userRole}</p>
                                </div>
                            </div>
                        </div>

                        <div className="security-section">
                            <h3>Seguridad</h3>
                            <form onSubmit={handleChangePassword} className="password-form">
                                <div className="form-group">
                                    <label>Contraseña Actual</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        disabled
                                        placeholder="Contraseña actual"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nueva Contraseña</label>
                                        <input
                                            type="password"
                                            className="form-control"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            disabled
                                            placeholder="Nueva contraseña"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Confirmar Contraseña</label>
                                        <input
                                            type="password"
                                            className="form-control"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            disabled
                                            placeholder="Confirmar contraseña"
                                        />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn btn-primary" disabled>
                                        Actualizar Contraseña (Próximamente)
                                    </button>
                                </div>
                                {message.text && (
                                    <div className={`alert ${message.type}`}>
                                        {message.text}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .profile-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .profile-header {
          background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
          color: white;
          padding: 3rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .avatar-circle {
          width: 80px;
          height: 80px;
          background: white;
          color: #607d8b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 1rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }

        .profile-header h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
        }

        .role-badge {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          text-transform: capitalize;
        }

        .profile-body {
          padding: 2rem;
        }

        .info-section, .security-section {
          margin-bottom: 2rem;
        }

        h3 {
          color: #37474f;
          border-bottom: 2px solid #eceff1;
          padding-bottom: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 1.25rem;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .info-item label {
          display: block;
          color: #78909c;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .info-item p {
          color: #263238;
          font-weight: 500;
          margin: 0;
          font-size: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-control {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #cfd8dc;
          border-radius: 4px;
          font-size: 1rem;
          color: #37474f;
        }

        .form-control:focus {
          outline: none;
          border-color: #607d8b;
          box-shadow: 0 0 0 2px rgba(96, 125, 139, 0.2);
        }

        .form-control:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .btn {
          width: 100%;
          padding: 0.75rem;
          border: none;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
        }

        .btn-primary {
          background-color: #607d8b;
          color: white;
        }

        .btn-primary:hover {
          background-color: #455a64;
        }
        
        .btn-primary:disabled {
          background-color: #b0bec5;
          cursor: not-allowed;
        }

        .alert {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 4px;
          text-align: center;
        }

        .alert.error {
          background-color: #ffebee;
          color: #c62828;
        }

        .alert.info {
          background-color: #e3f2fd;
          color: #1565c0;
        }

        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </>
    );
}
