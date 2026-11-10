import { useEffect, useRef } from 'react';

export const useClickOutside = (callback) => {
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                callback(event);
            }
        };

        // Use mousedown for better UX than click
        document.addEventListener('mousedown', handleClickOutside);
        // Also handle touch for mobile
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [callback]);

    return ref;
};