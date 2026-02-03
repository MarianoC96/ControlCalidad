'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';

export default function PerfilPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
  const [userEmail, setUserEmail] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [has2FA, setHas2FA] = useState(false);
  const [loading, setLoading] = useState(true);

  // 2FA Activation States
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [qrUri, setQrUri] = useState('');
  const [tempSecret, setTempSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
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
      setUserId(user.id);
      setUserName(user.nombre_completo);
      setUserRole(user.roles);
      setUserEmail(user.email || 'No especificado');
      setUserLogin(user.usuario);
      setHas2FA(!!user.two_factor_secret);
    } catch (error) {
      console.error('Error checking auth:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    try {
      setMessage({ text: '', type: '' });
      const response = await fetch('/api/auth/2fa/setup');
      const data = await response.json();
      if (response.ok) {
        setQrUri(data.uri);
        setTempSecret(data.secret);
        setShow2FASetup(true);
      } else {
        throw new Error(data.error || 'Error al generar configuración 2FA');
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleActivate2FA = async () => {
    if (verificationCode.length !== 6) {
      setMessage({ text: 'El código debe tener 6 dígitos', type: 'error' });
      return;
    }

    setIsActivating(true);
    try {
      const response = await fetch('/api/auth/2fa/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: tempSecret,
          code: verificationCode
        })
      });

      const data = await response.json();
      if (response.ok) {
        setHas2FA(true);
        setShow2FASetup(false);
        setMessage({ text: '¡Doble factor de autenticación (2FA) activado con éxito!', type: 'success' });
      } else {
        throw new Error(data.error || 'Error al activar 2FA');
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsActivating(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleDisable2FA = async () => {
    if (!confirm('¿Estás seguro de que deseas desactivar el 2FA? Tu cuenta será menos segura.')) return;
    try {
      const response = await fetch('/api/auth/2fa/disable', { method: 'POST' });
      if (response.ok) {
        setHas2FA(false);
        setMessage({ text: 'Se ha desactivado el 2FA correctamente.', type: 'info' });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Error al desactivar 2FA');
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  if (loading) return <div className="loader-screen">SINCRONIZANDO PERFIL...</div>;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUri)}&size=200x200&bgcolor=ffffff&color=1e293b`;

  return (
    <div className="profile-page-wrapper">
      <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

      <main className="main-content">
        {/* Hero Profile Card */}
        <div className="profile-hero shadow-sm border">
          <div className="hero-bg"></div>
          <div className="hero-content">
            <div className="avatar-section">
              <div className={`avatar-large ${userRole === 'administrador' ? 'admin-glow' : ''}`}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="user-basics">
                <h1>{userName}</h1>
                <div className="user-tags">
                  <span className={`badge-role ${userRole}`}>{userRole}</span>
                  <span className="badge-user">@{userLogin}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-grid mt-4">
          {/* Left Column: Personal Info */}
          <div className="grid-col">
            <section className="info-card shadow-sm border">
              <div className="card-header">
                <i className="bi bi-person-lines-fill"></i>
                <h3>Información Personal</h3>
              </div>
              <div className="card-body">
                <div className="detail-item">
                  <label>Correo Electrónico</label>
                  <p>{userEmail}</p>
                </div>
                <div className="detail-item">
                  <label>Usuario del Sistema</label>
                  <p>@{userLogin}</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Security/2FA */}
          <div className="grid-col">
            <section className="security-card shadow-sm border">
              <div className="card-header">
                <i className="bi bi-shield-lock-fill"></i>
                <h3>Seguridad de la Cuenta</h3>
              </div>
              <div className="card-body">
                <div className="status-2fa-box mb-4">
                  <div className="status-info">
                    <div className="fw-black">Doble Factor (2FA)</div>
                    <div className={`status-label ${has2FA ? 'active' : 'inactive'}`}>
                      {has2FA ? 'ACTIVADO' : 'DESACTIVADO'}
                    </div>
                  </div>
                  <div className={`status-icon ${has2FA ? 'active' : ''}`}>
                    <i className={`bi ${has2FA ? 'bi-shield-fill-check' : 'bi-shield-fill-x'}`}></i>
                  </div>
                </div>

                {!has2FA && !show2FASetup && (
                  <div className="promo-2fa">
                    <p>Añade una capa extra de seguridad a tu cuenta vinculándola con Google Authenticator o Authy.</p>
                    <button className="btn-setup-2fa" onClick={handleSetup2FA}>
                      <i className="bi bi-qr-code"></i> Configurar 2FA
                    </button>
                  </div>
                )}

                {has2FA && !show2FASetup && (
                  <div className="active-2fa-section">
                    <div className="active-2fa-msg">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Tu cuenta está protegida. Se solicitará un código cada vez que inicies sesión.</span>
                    </div>
                    <button className="btn-disable-2fa mt-3" onClick={handleDisable2FA}>
                      <i className="bi bi-shield-x"></i> Inhabilitar Seguridad 2FA
                    </button>
                  </div>
                )}

                {show2FASetup && (
                  <div className="setup-wizard border-top pt-4">
                    <div className="steps-instructions">
                      <div className="step">
                        <span className="num">1</span>
                        <p>Escanea este código con tu aplicación de autenticación (Google Authenticator, Authy, Microsoft Authenticator).</p>
                      </div>

                      <div className="qr-container my-4">
                        <img src={qrCodeUrl} alt="QR Code 2FA" className="qr-img border shadow-sm" />
                      </div>

                      <div className="step">
                        <span className="num">2</span>
                        <p>Introduce el código de 6 dígitos que aparece en tu aplicación para confirmar la vinculación.</p>
                      </div>

                      <div className="verify-input-group mt-3">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000 000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                        <button className="btn-activate" onClick={handleActivate2FA} disabled={isActivating}>
                          {isActivating ? 'Verificando...' : 'Activar Seguridad'}
                        </button>
                      </div>
                      <button className="btn-cancel-setup mt-3" onClick={() => setShow2FASetup(false)}>
                        Cancelar configuración
                      </button>
                    </div>
                  </div>
                )}

                {message.text && (
                  <div className={`alert-2fa mt-3 ${message.type}`}>
                    <i className={`bi ${message.type === 'success' ? 'bi-patch-check-fill' : 'bi-exclamation-triangle-fill'}`}></i>
                    {message.text}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <style jsx>{`
                .profile-page-wrapper {
                    min-height: 100vh;
                    background-color: #f8fafc;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .main-content {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }

                /* Hero Section */
                .profile-hero {
                    background: white;
                    border-radius: 24px;
                    overflow: hidden;
                    position: relative;
                }
                .hero-bg {
                    height: 120px;
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                }
                .hero-content {
                    padding: 0 40px 30px;
                    margin-top: -60px;
                }
                .avatar-section {
                    display: flex;
                    align-items: flex-end;
                    gap: 25px;
                }
                .avatar-large {
                    width: 120px;
                    height: 120px;
                    background: #3b82f6;
                    color: white;
                    border-radius: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3.5rem;
                    font-weight: 900;
                    border: 6px solid white;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
                }
                .admin-glow { background: #6366f1; box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4); }

                .user-basics h1 { margin: 0; font-size: 1.8rem; font-weight: 900; color: #1e293b; }
                .user-tags { display: flex; gap: 8px; margin-top: 8px; }
                .badge-role { padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
                .badge-role.administrador { background: #e0e7ff; color: #4338ca; }
                .badge-role.trabajador { background: #f1f5f9; color: #475569; }
                .badge-user { color: #3b82f6; font-weight: 800; font-size: 0.9rem; }

                /* Grid Layout */
                .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

                section { background: white; border-radius: 20px; padding: 30px; }
                .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
                .card-header i { font-size: 1.5rem; color: #3b82f6; }
                .card-header h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b; }

                .detail-item { margin-bottom: 20px; }
                .detail-item label { display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
                .detail-item p { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }

                /* 2FA Styles */
                .status-2fa-box {
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border: 1px solid #e2e8f0;
                }
                .status-label { font-size: 0.65rem; font-weight: 900; letter-spacing: 1px; margin-top: 4px; }
                .status-label.active { color: #10b981; }
                .status-label.inactive { color: #94a3b8; }
                .status-icon { width: 40px; height: 40px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #94a3b8; }
                .status-icon.active { background: #d1fae5; color: #10b981; }

                .promo-2fa p { font-size: 0.9rem; color: #64748b; margin-bottom: 20px; }
                .btn-setup-2fa {
                    width: 100%;
                    background: #1e293b;
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 12px;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: 0.2s;
                }
                .btn-setup-2fa:hover { background: #0f172a; transform: translateY(-2px); }

                .active-2fa-msg { background: #ecfdf5; border: 1px solid #d1fae5; padding: 15px; border-radius: 12px; color: #065f46; display: flex; gap: 12px; font-size: 0.85rem; font-weight: 600; }
                .active-2fa-msg i { font-size: 1.2rem; }

                .btn-disable-2fa {
                    width: 100%;
                    background: #fee2e2;
                    color: #b91c1c;
                    border: 1px solid #fecaca;
                    padding: 10px;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: 0.2s;
                }
                .btn-disable-2fa:hover { background: #fecaca; }

                /* Wizard */
                .step { display: flex; gap: 12px; margin-bottom: 15px; }
                .num { width: 22px; height: 22px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; flex-shrink: 0; }
                .step p { margin: 0; font-size: 0.8rem; color: #475569; font-weight: 600; line-height: 1.4; }
                .qr-container { text-align: center; }
                .qr-img { padding: 10px; background: white; border-radius: 12px; width: 180px; }

                .verify-input-group { display: flex; gap: 10px; }
                .verify-input-group input {
                    flex: 1;
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    text-align: center;
                    font-size: 1.2rem;
                    font-weight: 900;
                    letter-spacing: 5px;
                    outline: none;
                }
                .verify-input-group input:focus { border-color: #3b82f6; }
                .btn-activate { background: #10b981; color: white; border: none; padding: 0 20px; border-radius: 12px; font-weight: 800; transition: 0.2s; }
                .btn-activate:hover { background: #059669; }
                .btn-cancel-setup { background: none; border: none; color: #94a3b8; font-size: 0.8rem; font-weight: 700; width: 100%; text-align: center; }

                .alert-2fa { padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 700; }
                .alert-2fa.success { background: #d1fae5; color: #065f46; }
                .alert-2fa.error { background: #fee2e2; color: #b91c1c; }

                .loader-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-weight: 900; color: #3b82f6; letter-spacing: 2px; }

                @media (max-width: 768px) {
                    .profile-grid { grid-template-columns: 1fr; }
                    .avatar-section { flex-direction: column; align-items: center; text-align: center; }
                }
            `}</style>
    </div>
  );
}
