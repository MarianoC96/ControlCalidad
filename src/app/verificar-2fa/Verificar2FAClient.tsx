'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Verificar2FAClient() {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userId = sessionStorage.getItem('pendingUserId');

            if (!userId) {
                router.push('/');
                return;
            }

            const response = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: parseInt(userId), code }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Código inválido');
            }

            // Clear pending user and redirect
            sessionStorage.removeItem('pendingUserId');
            router.push('/registro-productos');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error de verificación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="verify-container">
            <div className="verify-card">
                <div className="verify-header">
                    <h1>Verificación 2FA</h1>
                    <p>Ingrese el código de su aplicación de autenticación</p>
                </div>

                <form onSubmit={handleSubmit} className="verify-form">
                    <div className="form-group">
                        <label htmlFor="code" className="form-label">
                            Código de verificación
                        </label>
                        <input
                            type="text"
                            id="code"
                            className="form-control code-input"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            maxLength={6}
                            required
                            autoComplete="one-time-code"
                            autoFocus
                        />
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary verify-btn"
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? 'Verificando...' : 'Verificar'}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary back-btn"
                        onClick={() => {
                            sessionStorage.removeItem('pendingUserId');
                            router.push('/');
                        }}
                    >
                        Volver al inicio
                    </button>
                </form>
            </div>

            <style jsx>{`
        .verify-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
          padding: 1rem;
        }

        .verify-card {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 2rem;
          width: 100%;
          max-width: 400px;
        }

        .verify-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .verify-header h1 {
          color: #607d8b;
          font-size: 1.5rem;
          margin: 0 0 0.5rem 0;
        }

        .verify-header p {
          color: #6c757d;
          margin: 0;
          font-size: 0.9rem;
        }

        .verify-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .code-input {
          text-align: center;
          font-size: 2rem;
          letter-spacing: 0.5rem;
          font-weight: bold;
        }

        .verify-btn {
          width: 100%;
          padding: 0.75rem;
        }

        .back-btn {
          width: 100%;
          padding: 0.5rem;
          font-size: 0.875rem;
        }
      `}</style>
        </div>
    );
}
