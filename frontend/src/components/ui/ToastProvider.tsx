import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#0f1429',
          color: '#e2e8f0',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          fontSize: '0.9rem',
        },
        success: {
          iconTheme: {
            primary: '#34d399',
            secondary: '#0f1429',
          },
        },
        error: {
          iconTheme: {
            primary: '#f43f5e',
            secondary: '#0f1429',
          },
        },
      }}
    />
  );
}
