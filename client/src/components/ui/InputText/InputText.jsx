import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { useInput } from '../../../hooks/useInput';
import { inputTextTokens } from '../../../theme/tokens';
import styles from './InputText.module.css';

const InputText = forwardRef(({
    // Core props
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,

    // Appearance
    placeholder = '',
    size = 'medium',      // small, medium, large
    variant = 'outlined', // outlined, filled, borderless
    status,               // error, warning
    disabled = false,
    readOnly = false,

    // Features
    allowClear = false,
    prefix,               // Icon/content before input
    suffix,               // Icon/content after input
    maxLength,
    showCount = false,

    // Styling
    className = '',
    style = {},

    // HTML attributes
    id,
    name,
    autoComplete,
    autoFocus,
    type = 'text',

    // Accessibility
    ariaLabel,
    ariaDescribedby,

    // Other
    ...restProps
}, ref) => {

    // Use our custom hook
    const {
        value: inputValue,
        isFocused,
        isHovered,
        inputRef,
        clear,
        handleChange,
        handleFocus,
        handleBlur,
        handleMouseEnter,
        handleMouseLeave,
        state,
    } = useInput({
        value,
        defaultValue,
        onChange,
        onFocus,
        onBlur,
        disabled,
        readOnly,
    });

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => clear(),
        input: inputRef.current,
    }));

    // Compute component classes
    const componentClasses = useMemo(() => {
        return [
            styles.inputWrapper,
            styles[`size-${size}`],
            styles[`variant-${variant}`],
            state.isFocused && styles.focused,
            state.isHovered && !state.isDisabled && styles.hovered,
            state.isDisabled && styles.disabled,
            state.isReadOnly && styles.readOnly,
            status === 'error' && styles.error,
            status === 'warning' && styles.warning,
            prefix && styles.hasPrefix,
            suffix && styles.hasSuffix,
            allowClear && inputValue && styles.hasClear,
            className,
        ].filter(Boolean).join(' ');
    }, [state, status, size, variant, prefix, suffix, allowClear, inputValue, className]);

    // Character count
    const characterCount = useMemo(() => {
        if (maxLength && showCount) {
            return `${inputValue?.length || 0}/${maxLength}`;
        }
        return null;
    }, [inputValue, maxLength, showCount]);

    return (
        <span
            className={componentClasses}
            style={style}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Prefix */}
            {prefix && (
                <span className={styles.prefix}>
                    {prefix}
                </span>
            )}

            {/* Main Input */}
            <input
                ref={inputRef}
                type={type}
                value={inputValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                readOnly={readOnly}
                maxLength={maxLength}
                id={id}
                name={name}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedby}
                className={styles.input}
                {...restProps}
            />

            {/* Clear Button */}
            {allowClear && inputValue && !disabled && !readOnly && (
                <span
                    className={styles.clearButton}
                    onClick={clear}
                    role="button"
                    tabIndex={-1}
                    aria-label="Clear input"
                >
                    ✕
                </span>
            )}

            {/* Suffix */}
            {suffix && (
                <span className={styles.suffix}>
                    {suffix}
                </span>
            )}

            {/* Character Count */}
            {characterCount && (
                <span className={styles.count}>
                    {characterCount}
                </span>
            )}
        </span>
    );
});

InputText.displayName = 'InputText';

export default InputText;
