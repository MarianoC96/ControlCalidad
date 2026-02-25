'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function PerfilPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
  const [userEmail, setUserEmail] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error checking auth:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) return <div className="loader-screen">SINCRONIZANDO PERFIL...</div>;

  return (
    <div className="profile-page-wrapper">

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
          {/* Personal Info */}
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
                .profile-grid { display: grid; grid-template-columns: 1fr; gap: 24px; max-width: 600px; }

                section { background: white; border-radius: 20px; padding: 30px; }
                .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
                .card-header i { font-size: 1.5rem; color: #3b82f6; }
                .card-header h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b; }

                .detail-item { margin-bottom: 20px; }
                .detail-item label { display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
                .detail-item p { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }

                .loader-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-weight: 900; color: #3b82f6; letter-spacing: 2px; }

                @media (max-width: 768px) {
                    .avatar-section { flex-direction: column; align-items: center; text-align: center; }
                }
            `}</style>
    </div>
  );
}
