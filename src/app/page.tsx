'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [error2FA, setError2FA] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        setPendingUserId(data.userId);
        setShow2FAModal(true);
        setLoading(false);
        return;
      }

      // Redirect to main page only if no 2FA is required
      router.push('/registro-productos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError2FA('');
    setVerifying2FA(true);

    try {
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, code: twoFactorCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código de seguridad incorrecto');
      }

      // Success! Now redirect
      router.push('/registro-productos');
    } catch (err) {
      setError2FA(err instanceof Error ? err.message : 'Error de verificación');
    } finally {
      setVerifying2FA(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card shadow-lg">
        <div className="login-header">
          <div className="system-logo">CC</div>
          <h1>Control de Calidad</h1>
          <p>Gestión y Registro Profesional</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group-p">
            <label htmlFor="usuario">Usuario o Correo</label>
            <div className="input-with-icon">
              <i className="bi bi-person-fill"></i>
              <input
                type="text"
                id="usuario"
                value={formData.usuario}
                onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                required
                placeholder="Ingresa tu ID"
              />
            </div>
          </div>

          <div className="form-group-p">
            <label htmlFor="password">Contraseña</label>
            <div className="input-with-icon">
              <i className="bi bi-lock-fill"></i>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="login-error-alert">
              <i className="bi bi-exclamation-circle-fill"></i>
              {error}
            </div>
          )}

          <button type="submit" className="btn-login-premium" disabled={loading}>
            {loading ? <span className="loader-btn"></span> : 'Ingresar al Sistema'}
          </button>

          <div className="login-footer-links">
            <a href="/olvide-password">¿Problemas con el acceso?</a>
          </div>
        </form>
      </div>

      {/* 2FA MODAL PREMIUM */}
      {show2FAModal && (
        <div className="modal-overlay-2fa">
          <div className="modal-content-2fa shadow-2xl">
            <div className="modal-header-2fa">
              <div className="shield-icon">
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <h2>Verificación de Seguridad</h2>
              <p>Tu cuenta tiene activo el Doble Factor. Ingresa el código de 6 dígitos de tu aplicación.</p>
            </div>

            <form onSubmit={handleVerify2FA} className="modal-form-2fa">
              <div className="code-input-wrapper">
                <input
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000 000"
                  autoFocus
                  required
                />
              </div>

              {error2FA && (
                <div className="error-2fa-msg">
                  <i className="bi bi-x-circle-fill"></i> {error2FA}
                </div>
              )}

              <button type="submit" className="btn-verify-2fa" disabled={verifying2FA || twoFactorCode.length !== 6}>
                {verifying2FA ? 'Verificando...' : 'Confirmar Identidad'}
              </button>

              <button type="button" className="btn-cancel-2fa" onClick={() => setShow2FAModal(false)}>
                Cancelar y volver
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 20px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .login-card {
          background: white;
          border-radius: 28px;
          padding: 50px 40px;
          width: 100%;
          max-width: 440px;
          text-align: center;
        }

        .system-logo {
          width: 60px;
          height: 60px;
          background: #3b82f6;
          color: white;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 1.5rem;
          margin: 0 auto 20px;
          box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
        }

        .login-header h1 {
          font-size: 1.7rem;
          font-weight: 900;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .login-header p {
          color: #64748b;
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 40px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: left;
        }

        .form-group-p label {
          display: block;
          font-size: 0.75rem;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .input-with-icon {
          position: relative;
        }

        .input-with-icon i {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 1.1rem;
        }

        .input-with-icon input {
          width: 100%;
          padding: 14px 14px 14px 48px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 600;
          color: #1e293b;
          transition: 0.2s;
          outline: none;
        }

        .input-with-icon input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .btn-login-premium {
          background: #1e293b;
          color: white;
          border: none;
          padding: 16px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          transition: 0.2s;
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-login-premium:hover {
          background: #0f172a;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .btn-login-premium:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .loader-btn {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-error-alert {
          background: #fee2e2;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .login-footer-links {
          text-align: center;
          margin-top: 10px;
        }

        .login-footer-links a {
          color: #3b82f6;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 700;
        }

        /* 2FA MODAL */
        .modal-overlay-2fa {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content-2fa {
          background: white;
          width: 100%;
          max-width: 400px;
          border-radius: 32px;
          padding: 40px;
          text-align: center;
        }

        .shield-icon {
          width: 70px;
          height: 70px;
          background: #dcfce7;
          color: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto 24px;
        }

        .modal-header-2fa h2 {
          font-size: 1.5rem;
          font-weight: 900;
          color: #1e293b;
          margin-bottom: 12px;
        }

        .modal-header-2fa p {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 600;
          line-height: 1.5;
          margin-bottom: 30px;
        }

        .code-input-wrapper input {
          width: 100%;
          padding: 16px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          font-size: 2rem;
          font-weight: 900;
          text-align: center;
          letter-spacing: 8px;
          color: #1e293b;
          outline: none;
          margin-bottom: 20px;
        }

        .code-input-wrapper input:focus {
          border-color: #3b82f6;
          background: white;
        }

        .btn-verify-2fa {
          width: 100%;
          background: #3b82f6;
          color: white;
          border: none;
          padding: 16px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          transition: 0.2s;
        }

        .btn-verify-2fa:hover {
          background: #2563eb;
          transform: translateY(-2px);
        }

        .btn-verify-2fa:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .btn-cancel-2fa {
          background: none;
          border: none;
          color: #94a3b8;
          font-weight: 700;
          font-size: 0.85rem;
          margin-top: 20px;
          cursor: pointer;
        }

        .error-2fa-msg {
          color: #ef4444;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
}
