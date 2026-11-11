import React from 'react';
import {
    BiGridAlt,
    BiUser,
    BiShieldQuarter,
    BiImage,
    BiServer,
    BiColumns,
    BiHistory,
    BiBriefcase,
    BiFolder,
    BiCog,
    BiBot,
    BiLineChart,
    BiRuler
} from 'react-icons/bi';

export const menuItems = [
    {
        title: "Dashboard",
        label: "Dashboard",
        icon: <BiGridAlt />,
        path: "/"
    },
    {
        title: "Staff Directory",
        label: "Staff Directory",
        icon: <BiUser />,
        submenu: [
            {
                title: "All Staff",
                label: "All Staff",
                path: "/users"
            },
            {
                title: "Active Columns",
                label: "Active Columns",
                path: "/users/columns"
            }
        ]
    },
    {
        title: "Clients",
        label: "Clients",
        icon: <BiBriefcase />,
        submenu: [
            {
                title: "All Clients",
                label: "All Clients",
                path: "/clients"
            },
            {
                title: "Active Columns",
                label: "Active Columns",
                path: "/clients/columns"
            }
        ]
    },
    {
        title: "Projects",
        label: "Projects",
        icon: <BiFolder />,
        submenu: [
            {
                title: "All Projects",
                label: "All Projects",
                path: "/projects"
            },
            {
                title: "Active Columns",
                label: "Active Columns",
                path: "/projects/columns"
            }
        ]
    },
    {
        title: "Takeoff & Estimations",
        label: "Takeoff & Estimations",
        icon: <BiRuler />,
        path: "/takeoff"
    },
    {
        title: "Database Tables",
        label: "Database Tables",
        icon: <BiServer />,
        path: "/database/tables"
    },
    {
        title: "Roles & Permissions",
        label: "Roles & Permissions",
        icon: <BiShieldQuarter />,
        path: "/roles"
    },
    {
        title: "Media Library",
        label: "Media Library",
        icon: <BiImage />,
        path: "/media"
    },
    {
        title: "Activity Logs",
        label: "Activity Logs",
        icon: <BiHistory />,
        path: "/activity-logs"
    },
    {
        title: "User Activity",
        label: "User Activity",
        icon: <BiLineChart />,
        path: "/tracking/users"
    },
    {
        title: "AI Assistant",
        label: "AI Assistant",
        icon: <BiBot />,
        path: "/ai-assistant"
    },
    {
        title: "Settings",
        label: "Settings",
        icon: <BiCog />,
        submenu: [
            {
                title: "AI Models & Guardrails",
                label: "AI Models & Guardrails",
                path: "/settings/ai-models"
            },
            {
                title: "Google Drive Configuration",
                label: "Google Drive Configuration",
                path: "/settings/google-drive"
            }
        ]
    }
];

export default menuItems;
