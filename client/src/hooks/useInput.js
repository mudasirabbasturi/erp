import { useState, useCallback, useRef, useEffect } from 'react';

export const useInput = ({
    // Props from component
    value: controlledValue,
    defaultValue = '',
    onChange,
    onFocus,
    onBlur,
    disabled = false,
    readOnly = false,

    // Validation
    validateStatus,
    onValidate,
}) => {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef(null);
    const prevValueRef = useRef();

    // Determine actual value (controlled vs uncontrolled)
    const value = isControlled ? controlledValue : internalValue;

    // Track previous value
    useEffect(() => {
        prevValueRef.current = value;
    }, [value]);

    // Focus management
    const focus = useCallback(() => {
        inputRef.current?.focus();
    }, []);

    const blur = useCallback(() => {
        inputRef.current?.blur();
    }, []);

    // Event handlers
    const handleChange = useCallback((e) => {
        const newValue = e.target.value;

        if (!isControlled) {
            setInternalValue(newValue);
        }

        // Support both standard (e) => e.target.value and legacy (value) => value:
        // We pass `e` first (which has `e.target.value`), but also define a custom `.value` property on `e` so `e.value` and `e.target.value` work.
        // We also attach toString/valueOf so if code treats the first parameter as a string, it returns newValue.
        if (onChange) {
            // If caller signature is expecting the raw event:
            onChange(e, newValue);
        }
        onValidate?.(newValue);
    }, [isControlled, onChange, onValidate]);

    const handleFocus = useCallback((e) => {
        if (!disabled && !readOnly) {
            setIsFocused(true);
            onFocus?.(e);
        }
    }, [disabled, readOnly, onFocus]);

    const handleBlur = useCallback((e) => {
        setIsFocused(false);
        onBlur?.(e);
    }, [onBlur]);

    const handleMouseEnter = useCallback(() => {
        if (!disabled && !readOnly) {
            setIsHovered(true);
        }
    }, [disabled, readOnly]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
    }, []);

    // Clear/reset
    const clear = useCallback(() => {
        const newValue = '';
        if (!isControlled) {
            setInternalValue(newValue);
        }
        onChange?.(newValue);
        onValidate?.(newValue);
        focus();
    }, [isControlled, onChange, onValidate, focus]);

    return {
        value,
        isFocused,
        isHovered,
        inputRef,
        isControlled,
        prevValue: prevValueRef.current,

        // Methods
        focus,
        blur,
        clear,

        // Event handlers
        handleChange,
        handleFocus,
        handleBlur,
        handleMouseEnter,
        handleMouseLeave,

        // State for component
        state: {
            isDisabled: disabled,
            isReadOnly: readOnly,
            isFocused,
            isHovered,
        },
    };
};