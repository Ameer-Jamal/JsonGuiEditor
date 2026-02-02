import React, { createContext, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
    id: string;
    message: string;
    type: ToastType;
};

type ToastContextValue = {
    addToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const createId = () => Math.random().toString(36).slice(2);

export const ToastProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (message: string, type: ToastType = 'info') => {
        const id = createId();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 2600);
    };

    const value = useMemo(() => ({ addToast }), []);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`rounded-lg px-3 py-2 text-xs font-medium shadow-lg border transition-all ${
                            toast.type === 'success'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : toast.type === 'error'
                                    ? 'bg-red-600 text-white border-red-600'
                                    : 'bg-slate-900 text-white border-slate-900'
                        }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
