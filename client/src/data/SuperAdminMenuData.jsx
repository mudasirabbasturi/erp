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

export const superAdminMenuItems = [
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
        title: "User Tracking",
        label: "User Tracking",
        icon: <BiLineChart />,
        submenu: [
            {
                title: "Team Tracking",
                label: "Team Tracking",
                path: "/tracking/users"
            },
            {
                title: "My Activity",
                label: "My Activity",
                path: "/tracking/my-activity"
            }
        ]
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
                title: "General Settings",
                label: "General Settings",
                path: "/settings/general"
            },
            {
                title: "API Keys & Sockets",
                label: "API Keys & Sockets",
                path: "/settings/api-keys"
            }
        ]
    }
];

export default superAdminMenuItems;
