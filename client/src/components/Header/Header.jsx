import React, { useState, useEffect, useRef } from 'react';
import { BiSidebar, BiMenu, BiMenuAltLeft, BiBell, BiChevronDown, BiUser, BiCog, BiLogOut, BiGridAlt } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMediaUrl } from '../../utils/media';
import styles from './Header.module.css';

const Header = ({ toggleSidebar, toggleSidebarSize, toggleSidebarVisibility, sidebarMode, isMobile }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        setIsDropdownOpen(false);
        logout();
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const displayName = user?.full_name || user?.username || 'User';
    const displayRole = user?.is_super_admin === 1 ? 'Super Admin' : (user?.role_name || 'Staff');
    const userAvatarPath = user?.avatar_file_path || user?.profile?.avatar_file_path;
    const avatarUrl = userAvatarPath
        ? getMediaUrl(userAvatarPath)
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`;

    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: '#4f46e5',
                    letterSpacing: '-0.5px',
                    cursor: 'pointer'
                }} onClick={() => navigate('/')}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#4f46e5',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <BiGridAlt size={20} />
                    </div>
                    <span>ERP</span>
                </div>

                {/* Mobile: single hamburger toggle */}
                {isMobile ? (
                    <button
                        className={styles.toggleButton}
                        onClick={toggleSidebar}
                        aria-label="Toggle Sidebar"
                    >
                        <BiMenu size={22} />
                    </button>
                ) : (
                    /* Desktop: two separate controls */
                    <div className={styles.sidebarControls}>
                        {/* Size toggle: expanded ↔ mini */}
                        <button
                            className={styles.toggleButton}
                            onClick={toggleSidebarSize}
                            aria-label={sidebarMode === 'expanded' ? 'Collapse to mini' : 'Expand sidebar'}
                            title={sidebarMode === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
                        >
                            {sidebarMode === 'expanded'
                                ? <BiMenuAltLeft size={22} />
                                : <BiMenu size={22} />}
                        </button>

                        <span className={styles.sidebarDivider} aria-hidden="true" />

                        <button
                            className={`${styles.visibilityPill} ${sidebarMode === 'hidden' ? styles.pillActive : ''}`}
                            onClick={toggleSidebarVisibility}
                            aria-label={sidebarMode === 'hidden' ? 'Show sidebar' : 'Hide sidebar'}
                        >
                            <BiSidebar size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.rightSection}>
                {/* Profile */}
                <div className={styles.profileContainer} ref={dropdownRef}>
                    <button
                        className={`${styles.profileButton} ${isDropdownOpen ? styles.active : ''}`}
                        onClick={toggleDropdown}
                        aria-expanded={isDropdownOpen}
                        aria-haspopup="true"
                    >
                        <img
                            src={avatarUrl}
                            alt="User"
                            className={styles.avatar}
                        />
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{displayName}</span>
                            <span className={styles.userRole}>{displayRole}</span>
                        </div>
                        <BiChevronDown size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <div className={styles.dropdownHeader}>
                                <span className={styles.dropdownLabel}>{displayRole}</span>
                            </div>
                            <button className={styles.dropdownItem} onClick={() => { setIsDropdownOpen(false); navigate('/settings'); }}>
                                <BiCog size={18} /> Settings
                            </button>
                            <div className={styles.divider}></div>
                            <button
                                className={`${styles.dropdownItem} ${styles.logout}`}
                                onClick={handleLogout}
                            >
                                <BiLogOut size={18} /> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
