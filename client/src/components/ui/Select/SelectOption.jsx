import React, { useCallback, memo } from 'react';
import styles from './Select.module.css';

const SelectOption = memo(({
    option,
    isSelected,
    isHighlighted,
    onClick,
    onMouseEnter,
    multiple,
    renderOption,
}) => {

    const handleClick = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(option);
    }, [option, onClick]);

    const handleMouseEnter = useCallback(() => {
        onMouseEnter?.();
    }, [onMouseEnter]);

    // Custom render
    if (renderOption) {
        return (
            <div
                className={`${styles.option} ${isSelected ? styles.selected : ''} ${isHighlighted ? styles.highlighted : ''}`}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                role="option"
                aria-selected={isSelected}
            >
                {renderOption(option)}
            </div>
        );
    }

    return (
        <div
            className={`${styles.option} ${isSelected ? styles.selected : ''} ${isHighlighted ? styles.highlighted : ''}`}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            role="option"
            aria-selected={isSelected}
            data-value={option.value}
        >
            {/* Checkmark for multiple */}
            {multiple && (
                <span className={styles.checkmark}>
                    {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </span>
            )}

            {/* Option label */}
            <span className={styles.optionLabel}>{option.label}</span>

            {/* Single select checkmark */}
            {!multiple && isSelected && (
                <span className={styles.singleCheckmark}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            )}
        </div>
    );
});

SelectOption.displayName = 'SelectOption';

export default SelectOption;