import React, { useState, useEffect } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import {
    BiGridAlt,
    BiUser,
    BiShieldQuarter,
    BiKey,
    BiColumns,
    BiCheckSquare,
    BiMenu,
    BiImage,
    BiFile,
    BiFolder,
    BiLink,
    BiBriefcase,
    BiCog,
    BiBot,
    BiLineChart,
    BiRuler
} from 'react-icons/bi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { superAdminMenuItems } from '../../data/SuperAdminMenuData';
import { menuItems as defaultStaticMenuItems } from '../../data/MenuData';
import SidebarItem from './SidebarItem';
import styles from './Sidebar.module.css';

const ICON_MAP = {
    BiGridAlt: <BiGridAlt />,
    BiUser: <BiUser />,
    BiShieldQuarter: <BiShieldQuarter />,
    BiKey: <BiKey />,
    BiColumns: <BiColumns />,
    BiCheckSquare: <BiCheckSquare />,
    BiMenu: <BiMenu />,
    BiImage: <BiImage />,
    BiFile: <BiFile />,
    BiFolder: <BiFolder />,
    BiBriefcase: <BiBriefcase />,
    BiCog: <BiCog />,
    BiBot: <BiBot />,
    BiLineChart: <BiLineChart />,
    BiRuler: <BiRuler />
};

const Sidebar = ({ sidebarMode, isMobile }) => {
    const { isSuperAdmin } = useAuth();
    const menus = isSuperAdmin ? superAdminMenuItems : defaultStaticMenuItems;
    const [openMenuIndex, setOpenMenuIndex] = useState(null);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const timeoutRef = React.useRef(null);

    const handleToggleMenu = (index) => {
        setOpenMenuIndex((prev) => (prev === index ? null : index));
    };

    const handleHover = (index) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (index !== null) {
            setHoveredIndex(index);
        } else {
            timeoutRef.current = setTimeout(() => {
                setHoveredIndex(null);
            }, 200); // 200ms grace period
        }
    };

    return (
        <aside
            className={`
                ${styles.sidebar} 
                ${styles[sidebarMode]} 
                ${isMobile ? styles.mobile : ' '}
            `}
        >
            <SimpleBar style={{ maxHeight: '100%' }}>
                <nav className={styles.nav}>
                    <ul className={styles.menuList}>
                        {menus.map((item, index) => (
                            <SidebarItem
                                key={index}
                                item={item}
                                isSidebarExpanded={sidebarMode === 'expanded'}
                                isOpen={openMenuIndex === index}
                                onToggle={() => handleToggleMenu(index)}
                                isFlyoutActive={hoveredIndex === index}
                                setFlyoutHovered={(hovered) => handleHover(hovered ? index : null)}
                            />
                        ))}
                    </ul>
                </nav>
            </SimpleBar>
        </aside>
    );
};

export default Sidebar;
