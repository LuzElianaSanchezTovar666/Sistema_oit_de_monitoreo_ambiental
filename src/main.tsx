import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Limpiar cualquier Service Worker o caché antiguo en desarrollo local para garantizar actualización inmediata
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
            registration.unregister();
        }
    }).catch(() => { });
}

createRoot(document.getElementById('root')!).render(<App />);
