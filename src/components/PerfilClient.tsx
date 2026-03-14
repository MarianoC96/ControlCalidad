'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

interface UserProfile {
  readonly nombre: string;
  readonly email: string;
  readonly rol: string;
  readonly usuario: string;
}

const INITIAL_PROFILE: UserProfile = {
  nombre: '',
  email: '',
  rol: '',
  usuario: ''
};

export default function PerfilClient() {
  const [userData, setUserData] = useState<UserProfile>(INITIAL_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;

        const data = await res.json();
        setUserData({
          nombre: data.nombre_completo || 'Usuario',
          email: data.email || '',
          rol: data.roles || 'Trabajador',
          usuario: data.usuario || ''
        });
      } catch (e) {
        console.error('Error cargando perfil:', e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  if (loading) {
    return <LoadingOverlay message="Cargando Perfil..." />;
  }

  return (
    <div className="profile-wrapper-minimal">
      {/* Cabecera Compacta */}
      <div className="compact-header-bg">
        <div className="gradient-blend"></div>
      </div>

      <div className="profile-content-tight">
        {/* Identidad de Usuario */}
        <section className="identity-block">
          <div className="avatar-circle">
            {userData.nombre.charAt(0).toUpperCase()}
          </div>
          <h1>{userData.nombre}</h1>
          <span className={`role-tag ${userData.rol.toLowerCase()}`}>
            {userData.rol.toUpperCase()}
          </span>
        </section>

        {/* Tarjeta de Información */}
        <main className="profile-main-card">
          <div className="card-top-line"></div>

          <div className="header-simple">
            <i className="bi bi-person-fill-gear"></i>
            <h3>Detalles de la Cuenta</h3>
          </div>

          <div className="info-grid-clean">
            <div className="info-box-v3">
              <label>Usuario</label>
              <div className="value-field">
                <i className="bi bi-at"></i>
                <span>{userData.usuario}</span>
              </div>
            </div>

            <div className="info-box-v3">
              <label>Correo Electrónico</label>
              <div className="value-field">
                <i className="bi bi-envelope"></i>
                <span>{userData.email}</span>
              </div>
            </div>

            <div className="info-box-v3 full-width">
              <label>Nombre del Titular</label>
              <div className="value-field">
                <i className="bi bi-person-check"></i>
                <span>{userData.nombre}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .profile-wrapper-minimal { 
          min-height: 100vh; 
          background: #f8fafc; 
          padding-bottom: 40px;
        }

        .compact-header-bg {
          height: 220px;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          position: relative;
        }
        .gradient-blend {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent, #f8fafc);
        }

        .profile-content-tight {
          max-width: 800px;
          margin: -110px auto 0;
          padding: 0 20px;
          position: relative;
          z-index: 10;
        }

        .identity-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 30px;
        }

        .avatar-circle {
          width: 100px; height: 100px;
          background: white; color: #1e293b;
          border-radius: 30px;
          display: flex; align-items: center; justify-content: center;
          font-size: 3rem; font-weight: 900;
          box-shadow: 0 15px 35px -5px rgba(0,0,0,0.2);
          border: 3px solid white;
          margin-bottom: 15px;
        }

        .identity-block h1 {
          font-size: 2.2rem; font-weight: 900; color: #1e293b;
          margin: 0 0 10px 0; letter-spacing: -1px;
        }

        .role-tag {
          background: #334155; color: white;
          padding: 6px 16px; border-radius: 50px;
          font-weight: 800; font-size: 0.75rem; letter-spacing: 1px;
        }
        .role-tag.administrador { background: #10b981; }

        .profile-main-card {
          background: white;
          border-radius: 28px;
          padding: 40px;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          position: relative;
          overflow: hidden;
        }
        .card-top-line {
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: #10b981;
        }

        .header-simple {
          display: flex; align-items: center; gap: 15px;
          margin-bottom: 30px; color: #1e293b;
        }
        .header-simple i { font-size: 1.5rem; color: #3b82f6; }
        .header-simple h3 { font-size: 1.3rem; font-weight: 800; margin: 0; }

        .info-grid-clean {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        .full-width { grid-column: span 2; }

        .info-box-v3 label {
          display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
          padding-left: 4px;
        }
        .value-field {
          background: #f8fafc; padding: 14px 18px;
          border-radius: 14px; border: 1px solid #f1f5f9;
          display: flex; align-items: center; gap: 12px;
          font-size: 1.05rem; font-weight: 700; color: #334155;
        }
        .value-field i { color: #3b82f6; opacity: 0.6; font-size: 1.2rem; }

        @media (max-width: 600px) {
          .info-grid-clean { grid-template-columns: 1fr; }
          .full-width { grid-column: span 1; }
          .identity-block h1 { font-size: 1.8rem; }
        }
      `}</style>
    </div>
  );
}
