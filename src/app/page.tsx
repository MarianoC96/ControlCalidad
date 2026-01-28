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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        sessionStorage.setItem('pendingUserId', data.userId.toString());
        router.push('/verificar-2fa');
        return;
      }

      // Redirect to main page
      router.push('/registro-productos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Control de Calidad</h1>
          <p>Sistema de Registro de Productos</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="usuario" className="form-label">
              Usuario o Correo
            </label>
            <input
              type="text"
              id="usuario"
              className="form-control"
              value={formData.usuario}
              onChange={(e) =>
                setFormData({ ...formData, usuario: e.target.value })
              }
              required
              autoComplete="username"
              placeholder="Ingrese su usuario o correo"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              autoComplete="current-password"
              placeholder="Ingrese su contraseña"
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>

          <div className="login-links">
            <a href="/olvide-password" className="link">
              ¿Olvidó su contraseña?
            </a>
          </div>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
          padding: 1rem;
        }

        .login-card {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 2rem;
          width: 100%;
          max-width: 400px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-header h1 {
          color: #607d8b;
          font-size: 1.75rem;
          margin: 0 0 0.5rem 0;
        }

        .login-header p {
          color: #6c757d;
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .login-btn {
          width: 100%;
          padding: 0.75rem;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .spinner-small {
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .login-links {
          text-align: center;
          margin-top: 0.5rem;
        }

        .link {
          color: #607d8b;
          text-decoration: none;
          font-size: 0.875rem;
        }

        .link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
