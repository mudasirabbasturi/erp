import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { BiChevronRight } from 'react-icons/bi';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './SidebarItem.module.css';

const SidebarItem = ({
    item,
    isSidebarExpanded,
    isOpen,
    onToggle,
    level = 0,
    isFlyoutActive,
    setFlyoutHovered
}) => {
    // For nested levels (>0), we manage their own open state locally
    const [isInternalOpen, setIsInternalOpen] = useState(false);
    const [flyoutTop, setFlyoutTop] = useState(0);
    const [isPositioned, setIsPositioned] = useState(false);

    const location = useLocation();
    const itemRef = useRef(null);
    const flyoutRef = useRef(null);

    // Smart Positioning for Flyout
    useLayoutEffect(() => {
        if (isFlyoutActive && !isSidebarExpanded && flyoutRef.current && itemRef.current) {
            const flyoutHeight = flyoutRef.current.offsetHeight;
            const windowHeight = window.innerHeight;
            const itemRect = itemRef.current.getBoundingClientRect();

            let topPos = itemRect.top;
            const margin = 12;

            // If it hits the bottom
            if (topPos + flyoutHeight > windowHeight - margin) {
                topPos = windowHeight - flyoutHeight - margin;
            }

            // Don't go above header
            if (topPos < 58) {
                topPos = 58;
            }

            setFlyoutTop(topPos);
            setIsPositioned(true);
        } else if (!isFlyoutActive) {
            setIsPositioned(false);
        }
    }, [isFlyoutActive, isSidebarExpanded]);

    // Auto-expand if a child route is active
    useEffect(() => {
        if (item.submenu) {
            const hasActiveChild = item.submenu.some(child =>
                location.pathname === child.path ||
                (child.submenu && child.submenu.some(sub => location.pathname === sub.path))
            );
            if (hasActiveChild) {
                if (level === 0 && !isOpen) {
                    onToggle && onToggle();
                } else if (level > 0) {
                    setIsInternalOpen(true);
                }
            }
        }
    }, [location.pathname]);

    const activeOpen = level === 0 ? isOpen : isInternalOpen;

    const handleToggle = () => {
        if (level === 0) {
            onToggle && onToggle();
        } else {
            setIsInternalOpen(!isInternalOpen);
        }
    };

    const handleMouseEnter = () => {
        if (!isSidebarExpanded && level === 0) {
            setFlyoutHovered(true);
        }
    };

    const handleMouseLeave = () => {
        if (!isSidebarExpanded && level === 0) {
            setFlyoutHovered(false);
        }
    };

    const handleFlyoutMouseEnter = () => {
        setFlyoutHovered(true);
    };

    const handleFlyoutMouseLeave = () => {
        setFlyoutHovered(false);
    };

    const MenuContent = (
        <div
            className={`
                ${styles.menuHeader}
                ${activeOpen ? styles.activeParent : ''}
                ${!isSidebarExpanded && level === 0 ? styles.miniHeader : ''}
                ${level > 0 ? styles.nestedHeader : ''}
            `}
            onClick={item.submenu ? handleToggle : undefined}
            tabIndex={0}
            role="button"
        >
            <span className={styles.icon}>
                {item.icon ? (
                    item.icon
                ) : level === 0 ? (
                    <span className={styles.charFallback}>
                        {(item.label || item.title || '?').charAt(0).toUpperCase()}
                    </span>
                ) : null}
            </span>

            {isSidebarExpanded && (
                <>
                    <span className={`${styles.title} ${level > 0 ? styles.subLabel : ''}`}>{item.label || item.title}</span>
                    {item.submenu && (
                        <motion.span
                            className={styles.chevron}
                            animate={{ rotate: activeOpen ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <BiChevronRight />
                        </motion.span>
                    )}
                </>
            )}
        </div>
    );

    return (
        <li
            className={`${styles.menuItem} ${level > 0 ? styles.nestedItem : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={itemRef}
        >
            {item.path && !item.submenu ? (
                <NavLink
                    to={item.path}
                    end={item.end !== undefined ? item.end : true}
                    className={({ isActive }) => `
                        ${styles.menuLink}
                        ${isActive ? styles.activeLink : ''}
                    `}
                >
                    {MenuContent}
                </NavLink>
            ) : (
                MenuContent
            )}

            {/* Recursion for Expanded Mode */}
            <AnimatePresence>
                {isSidebarExpanded && activeOpen && item.submenu && (
                    <motion.ul
                        className={styles.inlineSubmenu}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            duration: 0.25,
                            ease: [0.4, 0, 0.2, 1] // Standard smooth ease-in-out
                        }}
                        style={{ overflow: 'hidden' }}
                    >
                        {item.submenu.map((subItem, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ x: -8, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.04, duration: 0.2 }}
                            >
                                <SidebarItem
                                    item={subItem}
                                    isSidebarExpanded={isSidebarExpanded}
                                    level={level + 1}
                                />
                            </motion.div>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>

            {/* Mini Mode: Flyout Submenu via Portal */}
            {!isSidebarExpanded && level === 0 && isFlyoutActive && item.submenu && createPortal(
                <div
                    ref={flyoutRef}
                    className={styles.flyout}
                    style={{
                        top: flyoutTop,
                        visibility: isPositioned ? 'visible' : 'hidden'
                    }}
                    onMouseEnter={handleFlyoutMouseEnter}
                    onMouseLeave={handleFlyoutMouseLeave}
                >
                    <div className={styles.flyoutHeader}>
                        {item.label || item.title}
                    </div>
                    <ul className={styles.flyoutList}>
                        {item.submenu.map((subItem, idx) => (
                            <li key={idx}>
                                {subItem.submenu ? (
                                    <div className={styles.flyoutSubGroup}>
                                        <div className={styles.flyoutSubHeader}>{subItem.label || subItem.title}</div>
                                        {subItem.submenu.map((ss, sidx) => (
                                            <NavLink
                                                key={sidx}
                                                to={ss.path}
                                                end={ss.end !== undefined ? ss.end : true}
                                                className={({ isActive }) => `${styles.flyoutItem} ${isActive ? styles.flyoutActive : ''}`}
                                            >
                                                {ss.label || ss.title}
                                            </NavLink>
                                        ))}
                                    </div>
                                ) : (
                                    <NavLink
                                        to={subItem.path}
                                        end={subItem.end !== undefined ? subItem.end : true}
                                        className={({ isActive }) => `${styles.flyoutItem} ${isActive ? styles.flyoutActive : ''}`}
                                    >
                                        {subItem.label || subItem.title}
                                    </NavLink>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>,
                document.body
            )}
        </li>
    );
};

export default SidebarItem;
