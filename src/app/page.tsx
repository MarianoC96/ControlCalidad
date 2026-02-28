'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
      const supabase = createClient();
      const identifier = formData.usuario.trim().toLowerCase();

      // Atajo administrativo: sadmin puede usar su nombre
      const emailForAuth = identifier === 'sadmin'
        ? 'sadmin@controlcalidad.local'
        : identifier;

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password: formData.password,
      });

      if (authError) throw new Error('Usuario o contraseña incorrectos');

      router.push('/registro-productos');
      router.refresh();

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="system-logo">
          <i className="bi bi-shield-lock-fill"></i>
        </div>

        <div className="login-header">
          <h1>Control Calidad</h1>
          <p>Inicia sesión con tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group-p">
            <label>CORREO</label>
            <div className="input-with-icon">
              <i className="bi bi-person"></i>
              <input
                type="text"
                placeholder=""
                required
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
