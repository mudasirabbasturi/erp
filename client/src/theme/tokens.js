// Global Design Tokens
export const globalTokens = {
    // Colors
    colors: {
        primary: '#1677ff',
        primaryHover: '#4096ff',
        primaryActive: '#0958d9',
        success: '#52c41a',
        warning: '#faad14',
        error: '#ff4d4f',

        // Text
        text: '#000000d9',
        textSecondary: '#00000073',
        textTertiary: '#00000045',

        // Background
        bgContainer: '#ffffff',
        bgContainerDisabled: '#f5f5f5',
        bgElevated: '#ffffff',

        // Border
        border: '#d9d9d9',
        borderHover: '#4096ff',
        borderFocus: '#1677ff',
        borderError: '#ff4d4f',
    },

    // Typography
    typography: {
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '14px',
        fontSizeSM: '12px',
        fontSizeLG: '16px',
        lineHeight: 1.5715,
    },

    // Spacing
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
    },

    // Border
    border: {
        radius: '6px',
        radiusSM: '4px',
        radiusLG: '8px',
        width: '1px',
    },

    // Size
    control: {
        heightSM: '24px',
        height: '32px',
        heightLG: '40px',
        paddingHorizontal: '11px',
        paddingHorizontalSM: '7px',
        paddingHorizontalLG: '15px',
    },

    // Animation
    motion: {
        duration: '0.2s',
        durationSlow: '0.3s',
        durationFast: '0.1s',
        ease: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    },

    // Shadow
    shadow: {
        focus: '0 0 0 2px rgba(5, 145, 255, 0.1)',
        error: '0 0 0 2px rgba(255, 77, 79, 0.1)',
        warning: '0 0 0 2px rgba(250, 173, 20, 0.1)',
    },
};

// Component-specific tokens for InputText
export const inputTextTokens = {
    // Inherits from global + adds/overrides
    colorBgContainer: globalTokens.colors.bgContainer,
    colorBgContainerDisabled: globalTokens.colors.bgContainerDisabled,
    colorBorder: globalTokens.colors.border,
    colorBorderHover: globalTokens.colors.borderHover,
    colorBorderFocus: globalTokens.colors.borderFocus,
    colorBorderError: globalTokens.colors.borderError,
    colorText: globalTokens.colors.text,
    colorTextPlaceholder: globalTokens.colors.textTertiary,
    colorTextDisabled: globalTokens.colors.textTertiary,

    borderRadius: globalTokens.border.radius,
    controlHeight: globalTokens.control.height,
    controlHeightSM: globalTokens.control.heightSM,
    controlHeightLG: globalTokens.control.heightLG,
    paddingHorizontal: globalTokens.control.paddingHorizontal,
    fontSize: globalTokens.typography.fontSize,

    boxShadowFocus: globalTokens.shadow.focus,
    boxShadowError: globalTokens.shadow.error,
    boxShadowWarning: globalTokens.shadow.warning,

    motionDuration: globalTokens.motion.duration,
};