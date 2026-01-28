'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OlvidePasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al procesar la solicitud');
            }

            setMessage(data.message);
            setEmail('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>Control de Calidad</h1>
                    <p>Recuperar Contraseña</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">
                            Correo Electrónico / Usuario
                        </label>
                        <input
                            type="text"
                            id="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Ingrese su correo o usuario"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}
                    {message && <div className="alert alert-success">{message}</div>}

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? 'Enviando...' : 'Enviar Instrucciones'}
                    </button>
                </form>

                <div className="text-center mt-4">
                    <Link href="/" className="link">
                        Volver al inicio de sesión
                    </Link>
                </div>
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

        .alert-success {
          background-color: #d4edda;
          border-color: #c3e6cb;
          color: #155724;
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          margin-bottom: 1rem;
        }
      `}</style>
        </div>
    );
}
