import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { BiGridAlt, BiShield, BiCheckCircle } from 'react-icons/bi';
import styles from './Dashboard.module.css';

const Dashboard = () => {
    const { user, isSuperAdmin } = useAuth();

    return (
        <div className={styles.container}>
            <div className={styles.welcomeCard}>
                <div className={styles.badgeRow}>
                    <span className={styles.statusBadge}>
                        <BiCheckCircle /> System Active
                    </span>
                    {isSuperAdmin && (
                        <span className={styles.superBadge}>
                            <BiShield /> Super Admin Mode
                        </span>
                    )}
                </div>
                <h1 className={styles.title}>Welcome, {user?.username || 'User'}</h1>
                <p className={styles.subtitle}>
                    Your system dashboard workspace is ready. Modules and overview analytics will appear here as configured.
                </p>
            </div>

            <div className={styles.blankCanvas}>
                <div className={styles.blankInner}>
                    <BiGridAlt className={styles.blankIcon} />
                    <h3 className={styles.blankTitle}>Workspace Blank State</h3>
                    <p className={styles.blankText}>
                        Select a navigation item from the sidebar to manage Staff Directory, DB Schemas, or Roles & Permissions.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
