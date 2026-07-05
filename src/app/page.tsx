'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (blockedUntil === null) return;
    const tick = () => {
      const remaining = Math.ceil((blockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setBlockedUntil(null);
        setError('');
      } else {
        setSecondsLeft(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil]);

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

      if (response.status === 429 && typeof data.retryAfterSeconds === 'number') {
        setBlockedUntil(Date.now() + data.retryAfterSeconds * 1000);
        setLoading(false);
        return;
      }

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
                suppressHydrationWarning
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
                suppressHydrationWarning
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

          {blockedUntil !== null ? (
            <div className="login-error-alert">
              <i className="bi bi-hourglass-split"></i>
              <span>Demasiados intentos. Intentá de nuevo en {formatCountdown(secondsLeft)}.</span>
            </div>
          ) : error && (
            <div className="login-error-alert">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-login-premium" disabled={loading || blockedUntil !== null}>
            {loading ? <span className="loader-btn"></span> : 'INGRESAR AL SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  );
}
