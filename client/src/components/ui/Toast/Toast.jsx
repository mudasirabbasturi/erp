import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    BiCheckCircle,
    BiErrorCircle,
    BiInfoCircle,
    BiX
} from 'react-icons/bi';
import { GoAlert } from "react-icons/go";

import styles from './Toast.module.css';

const ToastContext = createContext(null);

export const ToastProvider = ({ children, defaultPlacement = 'topRight' }) => {
    const [toasts, setToasts] = useState([]);
    const [placement, setPlacement] = useState(defaultPlacement);

    const remove = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback(({
        type = 'info',
        message = '',
        description = '',
        duration = 3500,
        placement: customPlacement,
    }) => {
        const id = Date.now() + Math.random().toString(36).substring(2, 9);
        if (customPlacement) {
            setPlacement(customPlacement);
        }
        setToasts((prev) => [...prev, { id, type, message, description }]);

        if (duration > 0) {
            setTimeout(() => {
                remove(id);
            }, duration);
        }
        return id;
    }, [remove]);

    const success = useCallback((message, description, options = {}) => {
        return show({ type: 'success', message, description, ...options });
    }, [show]);

    const error = useCallback((message, description, options = {}) => {
        return show({ type: 'error', message, description, ...options });
    }, [show]);

    const warning = useCallback((message, description, options = {}) => {
        return show({ type: 'warning', message, description, ...options });
    }, [show]);

    const info = useCallback((message, description, options = {}) => {
        return show({ type: 'info', message, description, ...options });
    }, [show]);

    const addToast = useCallback((options) => {
        if (typeof options === 'string') {
            return show({ message: options });
        }
        const { type = 'info', title = '', message = '', ...rest } = options || {};
        return show({
            type,
            message: title || message,
            description: title && message ? message : (rest.description || ''),
            ...rest
        });
    }, [show]);

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <BiCheckCircle size={20} color="#10b981" />;
            case 'error':
                return <BiErrorCircle size={20} color="#ef4444" />;
            case 'warning':
                return <GoAlert size={20} color="#f59e0b" />;
            default:
                return <BiInfoCircle size={20} color="#4f46e5" />;
        }
    };

    const getTypeClass = (type) => {
        switch (type) {
            case 'success':
                return styles.toastSuccess;
            case 'error':
                return styles.toastError;
            case 'warning':
                return styles.toastWarning;
            default:
                return styles.toastInfo;
        }
    };

    const contextValue = useMemo(() => ({
        show,
        addToast,
        success,
        error,
        warning,
        info,
        remove,
        setPlacement
    }), [show, addToast, success, error, warning, info, remove]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            {typeof document !== 'undefined' && createPortal(
                <div className={`${styles.toastContainer} ${styles[placement] || styles.topRight}`}>
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`${styles.toastItem} ${getTypeClass(toast.type)}`}
                        >
                            <div className={styles.iconWrapper}>
                                {getIcon(toast.type)}
                            </div>
                            <div className={styles.contentWrapper}>
                                {toast.message && (
                                    <div className={styles.toastTitle}>{toast.message}</div>
                                )}
                                {toast.description && (
                                    <div className={styles.toastDescription}>{toast.description}</div>
                                )}
                            </div>
                            <button
                                type="button"
                                className={styles.closeButton}
                                onClick={() => remove(toast.id)}
                                aria-label="Close"
                            >
                                <BiX size={16} />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Fallback safe object so calling code doesn't crash if used outside provider
        return {
            addToast: (opt) => console.log('Toast:', opt),
            success: (msg) => console.log('Toast [Success]:', msg),
            error: (msg) => console.error('Toast [Error]:', msg),
            warning: (msg) => console.warn('Toast [Warning]:', msg),
            info: (msg) => console.info('Toast [Info]:', msg),
            show: () => { },
            remove: () => { },
            setPlacement: () => { },
        };
    }
    return ctx;
};

export default ToastProvider;
