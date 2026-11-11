import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageActionContext = createContext(null);

export const PageActionProvider = ({ children }) => {
    const [actions, setActions] = useState(null);
    const [customBreadcrumbs, setCustomBreadcrumbs] = useState(null);
    const location = useLocation();

    // Automatically reset stale custom breadcrumbs and page actions on route navigation
    useEffect(() => {
        setCustomBreadcrumbs(null);
        setActions(null);
    }, [location.pathname]);

    return (
        <PageActionContext.Provider value={{ actions, setActions, customBreadcrumbs, setCustomBreadcrumbs }}>
            {children}
        </PageActionContext.Provider>
    );
};

export const usePageActions = () => {
    const ctx = useContext(PageActionContext);
    if (!ctx) {
        return { actions: null, setActions: () => {}, customBreadcrumbs: null, setCustomBreadcrumbs: () => {} };
    }
    return ctx;
};
