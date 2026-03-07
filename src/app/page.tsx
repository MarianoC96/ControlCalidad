'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: formData.usuario.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Usuario o contraseña incorrectos');
      }

      router.push('/dashboard');
      router.refresh();

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="system-logo">
          <img src="/logo.png" alt="Logo El Olivar" className="w-full h-full object-contain p-2" />
        </div>

        <div className="login-header">
          <h1>Control Calidad - El Olivar</h1>
          <p>Inicia sesión con tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group-p">
            <label>USUARIO</label>
            <div className="input-with-icon">
              <i className="bi bi-person"></i>
              <input
                type="text"
                placeholder="Ingresa tu usuario"
                required
                autoComplete="username"
                value={formData.usuario}
                onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group-p">
            <label>CONTRASEÑA</label>
            <div className="input-with-icon">
              <i className="bi bi-lock"></i>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••"
                required
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error-alert">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-login-premium" disabled={loading}>
            {loading ? <span className="loader-btn"></span> : 'INGRESAR AL SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  );
}
