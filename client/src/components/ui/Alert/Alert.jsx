import React, { useState } from 'react';
import { BiCheckCircle, BiErrorCircle, BiInfoCircle, BiError, BiX } from 'react-icons/bi';
import styles from './Alert.module.css';

export const Alert = ({
    type = 'info',
    message,
    description,
    closable = false,
    onClose,
    icon,
    showIcon = true,
    style = {},
    className = ''
}) => {
    const [closed, setClosed] = useState(false);

    if (closed) return null;

    const handleClose = (e) => {
        setClosed(true);
        onClose?.(e);
    };

    const getDefaultIcon = () => {
        switch (type) {
            case 'success':
                return <BiCheckCircle size={18} color="#16a34a" />;
            case 'error':
                return <BiErrorCircle size={18} color="#dc2626" />;
            case 'warning':
                return <BiError size={18} color="#d97706" />;
            default:
                return <BiInfoCircle size={18} color="#2563eb" />;
        }
    };

    const getTypeClass = () => {
        switch (type) {
            case 'success': return styles.alertSuccess;
            case 'error': return styles.alertError;
            case 'warning': return styles.alertWarning;
            default: return styles.alertInfo;
        }
    };

    return (
        <div className={`${styles.alertContainer} ${getTypeClass()} ${className}`} style={style} role="alert">
            {showIcon && (
                <div className={styles.icon}>
                    {icon || getDefaultIcon()}
                </div>
            )}
            <div className={styles.content}>
                {message && <div className={styles.message}>{message}</div>}
                {description && <div className={styles.description}>{description}</div>}
            </div>
            {closable && (
                <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Close alert">
                    <BiX size={16} />
                </button>
            )}
        </div>
    );
};

export default Alert;
