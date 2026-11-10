import React, { forwardRef, useImperativeHandle, useMemo, useCallback, useState, useEffect } from 'react';
import { useInput } from '../../../hooks/useInput';
import { useValidation } from '../../../hooks/useValidation';
import { validateEmail, emailRegex } from '../../../utils/validators';
import styles from './InputEmail.module.css';

const InputEmail = forwardRef(({
    // Core props (inherited from InputText)
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,

    // Appearance
    placeholder = 'Enter email',
    size = 'medium',
    variant = 'outlined',
    disabled = false,
    readOnly = false,

    // Email-specific
    allowClear = true,
    multiple = false,           // Allow multiple emails (comma-separated)
    validateOnChange = false,   // Validate while typing
    validateOnBlur = true,     // Validate on blur
    domains,                    // Suggest domains
    domainSuggestions = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'],
    autoComplete = 'email',

    // Validation
    status,                     // Manually set status
    message,                    // Error/success message

    // Features
    prefix,
    suffix,
    showDomainSuggestions = true,

    // Styling
    className = '',
    style = {},

    // HTML
    id,
    name,

    // Accessibility
    ariaLabel = 'Email input',

    ...restProps
}, ref) => {

    // Custom validation rules
    const validationRules = useMemo(() => [
        {
            validator: (val) => {
                if (!val) return null;

                if (multiple) {
                    const emails = val.split(',').map(e => e.trim()).filter(Boolean);
                    for (const email of emails) {
                        if (!emailRegex.test(email)) {
                            return `"${email}" is not a valid email`;
                        }
                    }
                    return null;
                }

                return validateEmail(val);
            }
        }
    ], [multiple]);

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

    const {
        error: validationError,
        markAsTouched,
        reset: resetValidation,
    } = useValidation({
        value: inputValue,
        validateTrigger: validateOnChange ? 'onChange' : 'onBlur',
        rules: validationRules,
    });

    // Domain suggestion state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredDomains, setFilteredDomains] = useState([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

    const allDomains = domains || domainSuggestions;

    // Filter domain suggestions based on input
    useEffect(() => {
        if (!showDomainSuggestions || !inputValue || !inputValue.includes('@')) {
            setShowSuggestions(false);
            return;
        }

        const [localPart, domain] = inputValue.split('@');
        if (domain !== undefined && !inputValue.includes('@', inputValue.indexOf('@') + 1)) {
            const filtered = allDomains.filter(d =>
                d.toLowerCase().startsWith(domain.toLowerCase())
            );

            if (filtered.length > 0) {
                setFilteredDomains(filtered);
                setShowSuggestions(true);
                setSelectedSuggestionIndex(-1);
            } else {
                setShowSuggestions(false);
            }
        } else {
            setShowSuggestions(false);
        }
    }, [inputValue, showDomainSuggestions, allDomains]);

    // Handle domain suggestion click
    const handleSuggestionClick = useCallback((domain) => {
        const [localPart] = inputValue.split('@');
        const newEmail = `${localPart}@${domain}`;

        if (state.isControlled) {
            onChange?.(newEmail);
        } else {
            handleChange({ target: { value: newEmail } });
        }

        setShowSuggestions(false);
    }, [inputValue, onChange, handleChange, state.isControlled]);

    // Keyboard navigation for suggestions
    const handleKeyDown = useCallback((e) => {
        if (showSuggestions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < filteredDomains.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev > 0 ? prev - 1 : filteredDomains.length - 1
                );
            } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                e.preventDefault();
                handleSuggestionClick(filteredDomains[selectedSuggestionIndex]);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        }
    }, [showSuggestions, filteredDomains, selectedSuggestionIndex, handleSuggestionClick]);

    // Enhanced focus handler
    const enhancedHandleFocus = useCallback((e) => {
        markAsTouched();
        handleFocus(e);
    }, [markAsTouched, handleFocus]);

    // Enhanced blur handler
    const enhancedHandleBlur = useCallback((e) => {
        setTimeout(() => setShowSuggestions(false), 200);
        handleBlur(e);
    }, [handleBlur]);

    // Expose methods
    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => {
            clear();
            resetValidation();
        },
        input: inputRef.current,
        validate: () => validationError,
    }));

    // Determine status
    const componentStatus = status || (validationError ? 'error' : undefined);
    const displayMessage = message || validationError;

    // Compute classes
    const componentClasses = useMemo(() => {
        return [
            styles.emailWrapper,
            state.isFocused && styles.focused,
            componentStatus === 'error' && styles.error,
            state.isDisabled && styles.disabled,
            className,
        ].filter(Boolean).join(' ');
    }, [state, componentStatus, className]);

    return (
        <div className={componentClasses} style={style}>
            <span className={styles.inputContainer}>
                {/* Email Icon */}
                {prefix || (
                    <span className={styles.emailIcon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                    </span>
                )}

                <input
                    ref={inputRef}
                    type="email"
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={enhancedHandleFocus}
                    onBlur={enhancedHandleBlur}
                    onKeyDown={handleKeyDown}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readOnly}
                    multiple={multiple}
                    autoComplete={autoComplete}
                    id={id}
                    name={name}
                    aria-label={ariaLabel}
                    aria-invalid={componentStatus === 'error'}
                    aria-describedby={displayMessage ? `${id}-message` : undefined}
                    className={styles.input}
                    {...restProps}
                />

                {/* Clear Button */}
                {allowClear && inputValue && !disabled && !readOnly && (
                    <span className={styles.clearButton} onClick={() => { clear(); resetValidation(); }}>
                        ✕
                    </span>
                )}

                {suffix}
            </span>

            {/* Domain Suggestions */}
            {showSuggestions && filteredDomains.length > 0 && (
                <ul className={styles.suggestions} role="listbox">
                    {filteredDomains.map((domain, index) => (
                        <li
                            key={domain}
                            className={`${styles.suggestion} ${index === selectedSuggestionIndex ? styles.selected : ''}`}
                            onClick={() => handleSuggestionClick(domain)}
                            role="option"
                            aria-selected={index === selectedSuggestionIndex}
                        >
                            {domain}
                        </li>
                    ))}
                </ul>
            )}

            {/* Message */}
            {displayMessage && (
                <div
                    id={`${id}-message`}
                    className={`${styles.message} ${componentStatus === 'error' ? styles.errorMessage : ''}`}
                >
                    {displayMessage}
                </div>
            )}
        </div>
    );
});

InputEmail.displayName = 'InputEmail';

export default InputEmail;
