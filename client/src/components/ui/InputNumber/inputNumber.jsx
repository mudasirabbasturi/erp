import React, { forwardRef, useImperativeHandle, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useInput } from '../../../hooks/useInput';
import { useValidation } from '../../../hooks/useValidation';
import { validateNumber, formatNumber } from '../../../utils/validators';
import styles from './InputNumber.module.css';

const InputNumber = forwardRef(({
    // Core props
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,

    // Number-specific
    min = -Infinity,
    max = Infinity,
    step = 1,
    precision,               // Decimal places
    integerOnly = false,     // Only allow integers
    controls = true,         // Show increment/decrement buttons
    keyboard = true,         // Allow keyboard arrows
    formatter,               // Custom formatter
    parser,                  // Custom parser
    placeholder = '',

    // Appearance
    size = 'medium',
    variant = 'outlined',
    disabled = false,
    readOnly = false,

    // Features
    allowClear = true,
    prefix,
    suffix,

    // Validation
    status,
    message,

    // Styling
    className = '',
    style = {},

    // HTML
    id,
    name,

    // Accessibility
    ariaLabel = 'Number input',

    ...restProps
}, ref) => {

    const inputRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [displayValue, setDisplayValue] = useState('');

    // Determine if controlled
    const isControlled = value !== undefined;

    // Initialize display value
    useEffect(() => {
        const initialValue = isControlled ? value : defaultValue || '';
        setDisplayValue(formatNumber(initialValue, { precision, formatter }));
    }, []);

    // Sync display value with controlled value
    useEffect(() => {
        if (isControlled) {
            setDisplayValue(formatNumber(value, { precision, formatter }));
        }
    }, [value, isControlled, precision, formatter]);

    // Validation rules
    const validationRules = useMemo(() => [
        {
            validator: (val) => validateNumber(val, { min, max, step, integerOnly })
        }
    ], [min, max, step, integerOnly]);

    const {
        error: validationError,
        markAsTouched,
        reset: resetValidation,
    } = useValidation({
        value: isControlled ? value : displayValue,
        validateTrigger: 'onBlur',
        rules: validationRules,
    });

    // Handle input change
    const handleChange = useCallback((e) => {
        const inputVal = e.target.value;
        setDisplayValue(inputVal);

        if (inputVal === '' || inputVal === '-') {
            onChange?.(null);
            return;
        }

        const parsed = parseNumber(inputVal, { parser });
        if (!isNaN(parsed)) {
            onChange?.(parsed);
        }
    }, [onChange, parser]);

    // Increment/Decrement
    const getCurrentValue = useCallback(() => {
        const currentVal = isControlled ? value : displayValue;
        return Number(currentVal) || 0;
    }, [isControlled, value, displayValue]);

    const increment = useCallback(() => {
        const current = getCurrentValue();
        let newValue = current + step;

        if (newValue > max) newValue = max;
        if (precision !== undefined) {
            newValue = Number(newValue.toFixed(precision));
        }

        const formatted = formatNumber(newValue, { precision, formatter });
        setDisplayValue(formatted);
        onChange?.(newValue);
    }, [getCurrentValue, step, max, precision, formatter, onChange]);

    const decrement = useCallback(() => {
        const current = getCurrentValue();
        let newValue = current - step;

        if (newValue < min) newValue = min;
        if (precision !== undefined) {
            newValue = Number(newValue.toFixed(precision));
        }

        const formatted = formatNumber(newValue, { precision, formatter });
        setDisplayValue(formatted);
        onChange?.(newValue);
    }, [getCurrentValue, step, min, precision, formatter, onChange]);

    // Keyboard handling
    const handleKeyDown = useCallback((e) => {
        if (!keyboard || disabled || readOnly) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            increment();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            decrement();
        } else if (e.key === 'Enter') {
            // Format on enter
            const current = getCurrentValue();
            const formatted = formatNumber(current, { precision, formatter });
            setDisplayValue(formatted);
        }
    }, [keyboard, disabled, readOnly, increment, decrement, getCurrentValue, precision, formatter]);

    // Blur handler - format value
    const handleBlur = useCallback((e) => {
        setIsFocused(false);
        markAsTouched();

        const current = Number(displayValue);
        if (!isNaN(current)) {
            if (current < min) {
                setDisplayValue(formatNumber(min, { precision, formatter }));
                onChange?.(min);
            } else if (current > max) {
                setDisplayValue(formatNumber(max, { precision, formatter }));
                onChange?.(max);
            } else {
                const formatted = formatNumber(current, { precision, formatter });
                setDisplayValue(formatted);
            }
        }

        onBlur?.(e);
    }, [displayValue, min, max, precision, formatter, onChange, onBlur, markAsTouched]);

    // Focus handler
    const handleFocus = useCallback((e) => {
        setIsFocused(true);
        onFocus?.(e);
    }, [onFocus]);

    // Clear handler
    const handleClear = useCallback(() => {
        setDisplayValue('');
        onChange?.(null);
        resetValidation();
        inputRef.current?.focus();
    }, [onChange, resetValidation]);

    // Mouse handlers for increment/decrement buttons
    const [pressingButton, setPressingButton] = useState(null);
    const pressTimerRef = useRef(null);
    const pressIntervalRef = useRef(null);

    const startPress = useCallback((direction) => {
        setPressingButton(direction);

        // Initial delay then repeat
        pressTimerRef.current = setTimeout(() => {
            pressIntervalRef.current = setInterval(() => {
                if (direction === 'up') increment();
                else decrement();
            }, 50);
        }, 300);

        // First immediate press
        if (direction === 'up') increment();
        else decrement();
    }, [increment, decrement]);

    const stopPress = useCallback(() => {
        setPressingButton(null);
        clearTimeout(pressTimerRef.current);
        clearInterval(pressIntervalRef.current);
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            clearTimeout(pressTimerRef.current);
            clearInterval(pressIntervalRef.current);
        };
    }, []);

    // Expose methods
    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        increment,
        decrement,
        input: inputRef.current,
    }));

    // Determine status
    const componentStatus = status || (validationError ? 'error' : undefined);
    const displayMessage = message || validationError;

    // Compute classes
    const componentClasses = useMemo(() => {
        return [
            styles.numberWrapper,
            styles[`size-${size}`],
            styles[`variant-${variant}`],
            isFocused && styles.focused,
            isHovered && !disabled && styles.hovered,
            disabled && styles.disabled,
            componentStatus === 'error' && styles.error,
            controls && styles.hasControls,
            className,
        ].filter(Boolean).join(' ');
    }, [size, variant, isFocused, isHovered, disabled, componentStatus, controls, className]);

    const isAtMin = getCurrentValue() <= min;
    const isAtMax = getCurrentValue() >= max;

    return (
        <div className={componentClasses} style={style}>
            <span className={styles.inputContainer}>
                {prefix && <span className={styles.prefix}>{prefix}</span>}

                <input
                    ref={inputRef}
                    type="number"
                    value={displayValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onMouseEnter={() => !disabled && setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readOnly}
                    min={min}
                    max={max}
                    step={step}
                    id={id}
                    name={name}
                    aria-label={ariaLabel}
                    aria-invalid={componentStatus === 'error'}
                    className={styles.input}
                    {...restProps}
                />

                {allowClear && displayValue && !disabled && !readOnly && (
                    <span className={styles.clearButton} onClick={handleClear}>
                        ✕
                    </span>
                )}

                {suffix && <span className={styles.suffix}>{suffix}</span>}
            </span>

            {/* Increment/Decrement Controls */}
            {controls && !disabled && !readOnly && (
                <div className={styles.controls}>
                    <button
                        type="button"
                        className={`${styles.controlButton} ${isAtMax ? styles.disabled : ''}`}
                        onMouseDown={() => !isAtMax && startPress('up')}
                        onMouseUp={stopPress}
                        onMouseLeave={stopPress}
                        aria-label="Increment value"
                        tabIndex={-1}
                        disabled={isAtMax}
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <path d="M0 7.5L5 2.5L10 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </button>

                    <button
                        type="button"
                        className={`${styles.controlButton} ${isAtMin ? styles.disabled : ''}`}
                        onMouseDown={() => !isAtMin && startPress('down')}
                        onMouseUp={stopPress}
                        onMouseLeave={stopPress}
                        aria-label="Decrement value"
                        tabIndex={-1}
                        disabled={isAtMin}
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <path d="M0 2.5L5 7.5L10 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Message */}
            {displayMessage && (
                <div className={`${styles.message} ${componentStatus === 'error' ? styles.errorMessage : ''}`}>
                    {displayMessage}
                </div>
            )}
        </div>
    );
});

InputNumber.displayName = 'InputNumber';

export default InputNumber;
