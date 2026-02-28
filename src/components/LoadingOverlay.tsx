'use client';

import React from 'react';

interface LoadingOverlayProps {
    message?: string;
}

/**
 * LoadingOverlay - Componente estandarizado para estados de carga premium.
 * Implementa desenfoque de fondo y animaciones suaves para una experiencia de usuario superior.
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Sincronizando información...' }) => {
    return (
        <div className="global-loader-overlay">
            <div className="loader-content">
                <div className="premium-spinner">
                    <div className="inner-ring"></div>
                    <div className="outer-ring"></div>
                    <div className="icon-pulse">
                        <i className="bi bi-shield-check-fill"></i>
                    </div>
                </div>
                <div className="text-container">
                    <h4 className="loader-text">{message}</h4>
                    <div className="loader-bar">
                        <div className="loader-progress"></div>
                    </div>
                    <p className="loader-subtext">Por favor, espere un momento</p>
                </div>
            </div>
            <style jsx>{`
        .global-loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .loader-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          padding: 40px;
          border-radius: 32px;
          background: rgba(255, 255, 255, 0.4);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .premium-spinner {
          position: relative;
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .inner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 5px solid #f1f5f9;
          border-top: 5px solid #3b82f6;
          border-right: 5px solid #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }

        .outer-ring {
          position: absolute;
          width: 140%;
          height: 140%;
          border: 2px solid transparent;
          border-bottom: 2px solid #60a5fa;
          border-left: 2px solid #60a5fa;
          border-radius: 50%;
          animation: spinReverse 2s linear infinite;
          opacity: 0.2;
        }

        .icon-pulse {
          font-size: 2.5rem;
          color: #3b82f6;
          animation: iconPulse 2s ease-in-out infinite;
          z-index: 2;
        }

        .text-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .loader-text {
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 2px;
          margin: 0;
          text-transform: uppercase;
          font-size: 1rem;
        }

        .loader-subtext {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0;
          font-weight: 500;
        }

        .loader-bar {
          width: 180px;
          height: 6px;
          background: #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          margin: 4px 0;
        }

        .loader-progress {
          width: 60px;
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
          border-radius: 10px;
          animation: progressMove 1.8s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes spinReverse {
          to { transform: rotate(-360deg); }
        }

        @keyframes iconPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(59, 130, 246, 0)); }
          50% { transform: scale(1.15); filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.4)); }
        }

        @keyframes progressMove {
          0% { transform: translateX(-100%); width: 30%; }
          50% { width: 60%; }
          100% { transform: translateX(300%); width: 30%; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>
    );
};

export default LoadingOverlay;
