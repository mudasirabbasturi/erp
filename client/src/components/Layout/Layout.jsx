import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { BiHome, BiChevronRight } from 'react-icons/bi';
import { usePageActions } from '../../context/PageActionContext';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import styles from './Layout.module.css';
import contentStyles from './Content.module.css';

// Super Admin Page Components
import Dashboard from '../../pages/Dashboard/Dashboard';
import UsersList from '../../pages/Users/UsersList';
import UserForm from '../../pages/Users/UserForm';
import UserView from '../../pages/Users/UserView';
import UserMedia from '../../pages/Users/UserMedia';
import Roles from '../../pages/Roles/Roles';
import RolePermissions from '../../pages/Roles/RolePermissions';
import MediaLibrary from '../../pages/Media/MediaLibrary';
import UserDBSchema from '../../pages/Users/UserDBSchema';
import UserActiveColumns from '../../pages/Users/UserActiveColumns';
import DatabaseTables from '../../pages/Database/DatabaseTables';
import DatabaseTableColumns from '../../pages/Database/DatabaseTableColumns';
import ActivityLogsList from '../../pages/ActivityLogs/ActivityLogsList';
import ClientsList from '../../pages/Clients/ClientsList';
import ClientActiveColumns from '../../pages/Clients/ClientActiveColumns';
import ClientForm from '../../pages/Clients/ClientForm';
import ClientView from '../../pages/Clients/ClientView';
import ProjectsList from '../../pages/Projects/ProjectsList';
import ProjectActiveColumns from '../../pages/Projects/ProjectActiveColumns';
import ProjectForm from '../../pages/Projects/ProjectForm';
import ProjectView from '../../pages/Projects/ProjectView';
import AISettings from '../../pages/Settings/AISettings';
import GeneralSettings from '../../pages/Settings/GeneralSettings';
import AIChatPage from '../../pages/AI/AIChatPage';
import UserTracking from '../../pages/Tracking/UserTracking';
import MyActivity from '../../pages/Tracking/MyActivity';
import { TakeoffSessionsList, TakeoffWorkspace } from '../../modules/takeoff';

const Layout = () => {
    const [sidebarMode, setSidebarMode] = useState(() => {
        return localStorage.getItem('sidebarPreference') || 'expanded';
    });
    const [isMobile, setIsMobile] = useState(false);
    const location = useLocation();
    const { actions, customBreadcrumbs } = usePageActions();

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarMode('hidden');
            } else {
                setSidebarMode(localStorage.getItem('sidebarPreference') || 'expanded');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem('sidebarPreference', sidebarMode);
        }
    }, [sidebarMode, isMobile]);

    const triggerLayoutResize = () => {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
    };

    const toggleSidebar = () => {
        setSidebarMode((prev) => (prev === 'hidden' ? 'expanded' : 'hidden'));
        triggerLayoutResize();
    };

    const toggleSidebarSize = () => {
        setSidebarMode((prev) => {
            if (prev === 'hidden') return 'expanded';
            return prev === 'expanded' ? 'mini' : 'expanded';
        });
        triggerLayoutResize();
    };

    const toggleSidebarVisibility = () => {
        setSidebarMode((prev) => (prev === 'hidden' ? 'expanded' : 'hidden'));
        triggerLayoutResize();
    };

    const pathnames = location.pathname.split('/').filter((x) => x);
    const breadcrumbs = customBreadcrumbs ? (
        <nav className={contentStyles.breadcrumbContainer}>
            <Link to="/" className={contentStyles.breadcrumbLink}>
                <BiHome size={18} />
                <span>Home</span>
            </Link>
            {customBreadcrumbs.map((item, index) => {
                const last = index === customBreadcrumbs.length - 1;
                return (
                    <div key={item.to || index} className={contentStyles.breadcrumbItem}>
                        <BiChevronRight className={contentStyles.separator} />
                        {last || !item.to ? (
                            <span className={contentStyles.current}>{item.label}</span>
                        ) : (
                            <Link to={item.to} className={contentStyles.breadcrumbLink}>
                                {item.label}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    ) : pathnames.length > 0 ? (
        <nav className={contentStyles.breadcrumbContainer}>
            <Link to="/" className={contentStyles.breadcrumbLink}>
                <BiHome size={18} />
                <span>Home</span>
            </Link>
            {pathnames.map((value, index) => {
                const last = index === pathnames.length - 1;
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const label = value.charAt(0).toUpperCase() + value.slice(1).replace(/[-_]/g, ' ');
                return (
                    <div key={to} className={contentStyles.breadcrumbItem}>
                        <BiChevronRight className={contentStyles.separator} />
                        {last ? (
                            <span className={contentStyles.current}>{label}</span>
                        ) : (
                            <Link to={to} className={contentStyles.breadcrumbLink}>
                                {label}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    ) : null;

    return (
        <div className={styles.layout}>
            <Header
                toggleSidebar={toggleSidebar}
                toggleSidebarSize={toggleSidebarSize}
                toggleSidebarVisibility={toggleSidebarVisibility}
                sidebarMode={sidebarMode}
                isMobile={isMobile}
            />
            <div className={styles.container}>
                <Sidebar sidebarMode={sidebarMode} isMobile={isMobile} />

                {isMobile && sidebarMode !== 'hidden' && (
                    <div className={styles.backdrop} onClick={() => setSidebarMode('hidden')} />
                )}

                <main className={`${styles.mainContent} ${styles[sidebarMode]} ${isMobile ? styles.mobileMain : ''}`}>
                    <div className={styles.contentInner}>
                        <div className={contentStyles.pageHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {actions && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {actions}
                                    </div>
                                )}
                                {breadcrumbs}
                            </div>
                        </div>
                        <div className={`${contentStyles.pageBody} ${['/users', '/clients'].includes(location.pathname) || location.pathname.startsWith('/projects') || location.pathname.startsWith('/takeoff') || location.pathname.startsWith('/roles') ? contentStyles.pageBodyNoPadding : ''}`}>
                            <Routes>
                                {/* Super Admin Clean Direct Routes */}
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/takeoff" element={<TakeoffSessionsList />} />
                                <Route path="/takeoff/:sessionId" element={<TakeoffWorkspace />} />
                                <Route path="/takeoff/project/:projectId" element={<TakeoffSessionsList />} />
                                <Route path="/users" element={<UsersList />} />
                                <Route path="/users/create" element={<UserForm />} />
                                <Route path="/users/schema" element={<UserDBSchema />} />
                                <Route path="/users/columns" element={<UserActiveColumns />} />
                                <Route path="/database/tables" element={<DatabaseTables />} />
                                <Route path="/database/tables/:tableName" element={<DatabaseTableColumns />} />
                                <Route path="/users/edit/:id" element={<UserForm />} />
                                <Route path="/users/view/:id" element={<UserView />} />
                                <Route path="/users/:id/media" element={<UserMedia />} />
                                <Route path="/clients" element={<ClientsList />} />
                                <Route path="/clients/columns" element={<ClientActiveColumns />} />
                                <Route path="/clients/create" element={<ClientForm />} />
                                <Route path="/clients/edit/:id" element={<ClientForm />} />
                                <Route path="/clients/view/:id" element={<ClientView />} />
                                <Route path="/projects" element={<ProjectsList />} />
                                <Route path="/projects/status/:statusSlug" element={<ProjectsList />} />
                                <Route path="/projects/group/:groupSlug" element={<ProjectsList />} />
                                <Route path="/projects/columns" element={<ProjectActiveColumns />} />
                                <Route path="/projects/create" element={<ProjectForm />} />
                                <Route path="/projects/edit/:id" element={<ProjectForm />} />
                                <Route path="/projects/view/:id" element={<ProjectView />} />
                                <Route path="/roles" element={<Roles />} />
                                <Route path="/roles/:id/permissions" element={<RolePermissions />} />
                                <Route path="/media" element={<MediaLibrary />} />
                                <Route path="/activity-logs" element={<ActivityLogsList />} />
                                
                                {/* AI Assistant & Guardrails */}
                                <Route path="/ai-assistant" element={<AIChatPage />} />
                                <Route path="/settings/ai-models" element={<AISettings />} />
                                <Route path="/settings/general" element={<GeneralSettings />} />
                                <Route path="/settings/api-keys" element={<GeneralSettings />} />

                                {/* User Activity Tracking */}
                                <Route path="/tracking/users" element={<UserTracking />} />
                                <Route path="/tracking/my-activity" element={<MyActivity />} />
                                <Route path="/tracking/activity/:userId" element={<MyActivity />} />

                                <Route path="*" element={<Dashboard />} />
                            </Routes>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
