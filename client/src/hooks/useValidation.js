import { useState, useCallback, useEffect } from 'react';

export const useValidation = ({
    value,
    validateTrigger = 'onBlur', // onChange, onBlur, onSubmit
    rules = [],
    onValidate,
}) => {
    const [error, setError] = useState(null);
    const [isTouched, setIsTouched] = useState(false);

    const validate = useCallback((valueToValidate) => {
        if (!rules || rules.length === 0) {
            setError(null);
            return true;
        }

        for (const rule of rules) {
            if (rule.required && !valueToValidate) {
                const message = typeof rule.required === 'string' ? rule.required : 'This field is required';
                setError(message);
                onValidate?.(message);
                return false;
            }

            if (rule.validator) {
                const result = rule.validator(valueToValidate);
                if (result) {
                    setError(result);
                    onValidate?.(result);
                    return false;
                }
            }

            if (rule.pattern && valueToValidate) {
                if (!rule.pattern.test(valueToValidate)) {
                    setError(rule.message || 'Invalid format');
                    onValidate?.(rule.message);
                    return false;
                }
            }

            if (rule.min !== undefined && Number(valueToValidate) < rule.min) {
                setError(rule.message || `Minimum value is ${rule.min}`);
                onValidate?.(rule.message);
                return false;
            }

            if (rule.max !== undefined && Number(valueToValidate) > rule.max) {
                setError(rule.message || `Maximum value is ${rule.max}`);
                onValidate?.(rule.message);
                return false;
            }

            if (rule.len !== undefined && String(valueToValidate).length !== rule.len) {
                setError(rule.message || `Length must be ${rule.len}`);
                onValidate?.(rule.message);
                return false;
            }
        }

        setError(null);
        onValidate?.(null);
        return true;
    }, [rules, onValidate]);

    const handleValidate = useCallback((valueToValidate) => {
        if (validateTrigger === 'onChange' || (validateTrigger === 'onBlur' && isTouched)) {
            validate(valueToValidate);
        }
    }, [validateTrigger, isTouched, validate]);

    useEffect(() => {
        if (isTouched) {
            handleValidate(value);
        }
    }, [value, isTouched, handleValidate]);

    const markAsTouched = useCallback(() => {
        setIsTouched(true);
    }, []);

    const reset = useCallback(() => {
        setError(null);
        setIsTouched(false);
    }, []);

    return {
        error,
        isTouched,
        validate,
        markAsTouched,
        reset,
        handleValidate,
    };
};