import React, { createContext, useContext, useState } from 'react';

const PageActionContext = createContext(null);

export const PageActionProvider = ({ children }) => {
    const [actions, setActions] = useState(null);
    const [customBreadcrumbs, setCustomBreadcrumbs] = useState(null);

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
