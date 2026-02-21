'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value.replace(/\s/g, '') })}
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7 7 0 0 0 2.79-.588M5.21 3.088A7 7 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474z" />
                    <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0" />
                    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7" />
                  </svg>
                )}
              </button>
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

    </div>
  );
}
