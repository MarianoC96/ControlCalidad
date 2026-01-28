'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token no proporcionado. Solicita un nuevo enlace.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al restablecer la contraseña');
      }

      setSuccess(true);
      setTimeout(() => router.push('/'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success-content">
        <div className="success-icon">✓</div>
        <h2>¡Contraseña Actualizada!</h2>
        <p>Redirigiendo al inicio de sesión...</p>
      </div>
    );
  }

  return (
    <>
      <div className="login-header">
        <h1>Control de Calidad</h1>
        <p>Restablecer Contraseña</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Nueva Contraseña
          </label>
          <input
            type="password"
            id="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            disabled={loading || !token}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Confirmar Contraseña
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="form-control"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita la contraseña"
            required
            disabled={loading || !token}
          />
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading || !token}
        >
          {loading ? 'Procesando...' : 'Restablecer Contraseña'}
        </button>
      </form>

      <div className="text-center mt-4">
        <Link href="/" className="link">
          Volver al inicio de sesión
        </Link>
      </div>
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Cargando...</p>
    </div>
  );
}

export default function RestablecerPasswordPage() {
  return (
    <div className="login-container">
      <div className="login-card">
        <Suspense fallback={<LoadingFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #4a5568 100%);
          padding: 1rem;
        }

        .login-card {
          background: white;
          border-radius: 1rem;
          padding: 2rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-header h1 {
          color: #4a5568;
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .login-header p {
          color: #718096;
          font-size: 0.875rem;
        }

        .w-full {
          width: 100%;
        }

        .mt-4 {
          margin-top: 1rem;
        }

        .text-center {
          text-align: center;
        }

        .link {
          color: #667eea;
          text-decoration: none;
        }

        .link:hover {
          text-decoration: underline;
        }

        .success-content {
          text-align: center;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          background: #48bb78;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto 1rem;
        }

        .success-content h2 {
          color: #2d3748;
          margin-bottom: 0.5rem;
        }

        .success-content p {
          color: #718096;
        }

        .loading-container {
          text-align: center;
          padding: 2rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
