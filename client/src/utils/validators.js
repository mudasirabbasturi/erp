// Email validation
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (value) => {
    if (!value) return null;
    return emailRegex.test(value) ? null : 'Please enter a valid email';
};

// Number validation
export const validateNumber = (value, { min, max, step, integerOnly = false }) => {
    if (value === '' || value === null || value === undefined) return null;

    const num = Number(value);

    if (isNaN(num)) return 'Please enter a valid number';

    if (integerOnly && !Number.isInteger(num)) {
        return 'Please enter an integer';
    }

    if (min !== undefined && num < min) {
        return `Value must be at least ${min}`;
    }

    if (max !== undefined && num > max) {
        return `Value must be at most ${max}`;
    }

    if (step !== undefined && step > 0) {
        const remainder = ((num - (min || 0)) / step) % 1;
        if (Math.abs(remainder) > 0.00001 && Math.abs(remainder - 1) > 0.00001) {
            return `Value must be in steps of ${step}`;
        }
    }

    return null;
};

// Number formatting
export const formatNumber = (value, { precision, formatter, parser }) => {
    if (value === '' || value === null || value === undefined) return '';

    if (parser) {
        return parser(value);
    }

    let num = Number(value);
    if (isNaN(num)) return value;

    if (precision !== undefined) {
        num = Number(num.toFixed(precision));
    }

    if (formatter) {
        return formatter(num);
    }

    return String(num);
};

// Number parsing
export const parseNumber = (value, { parser }) => {
    if (parser) return parser(value);

    const num = Number(value);
    return isNaN(num) ? value : num;
};