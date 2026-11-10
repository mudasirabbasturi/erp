import React, {
    forwardRef,
    useState,
    useRef,
    useEffect,
    useMemo,
    useCallback,
    useImperativeHandle,
} from 'react';
import SelectOption from './SelectOption';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { useKeyboardNav } from '../../../hooks/useKeyboardNav';
import { filterOptions, isOptionSelected, getLabel } from '../../../utils/selectHelpers';
import styles from './Select.module.css';

const Select = forwardRef(({
    // Core props
    value,
    defaultValue,
    onChange,
    onSearch,
    onFocus,
    onBlur,
    onOpenChange,

    // Options
    options = [],
    optionFilterProp = 'label',
    filterOption,          // Custom filter function
    renderOption,          // Custom option renderer

    // Behavior
    multiple = false,      // Multi-select mode
    searchable = false,    // Enable search (YOUR REQUIREMENT!)
    allowClear = false,    // Show clear button
    disabled = false,
    loading = false,       // Loading state

    // Appearance
    placeholder = 'Please select',
    size = 'medium',
    variant = 'outlined',
    status,                // error, warning

    // Display
    showSearch = false,    // Alias for searchable
    maxTagCount,           // Max tags to show in multi-select
    maxTagPlaceholder,     // Custom placeholder for hidden tags

    // Features
    prefix,
    suffix,
    dropdownMatchSelectWidth = true,
    dropdownStyle,
    dropdownClassName,
    notFoundContent = 'No data',

    // Styling
    className = '',
    style = {},

    // HTML
    id,
    name,

    // Accessibility
    ariaLabel,

    ...restProps
}, ref) => {

    // Merge searchable and showSearch
    const canSearch = searchable || showSearch;

    // ===== STATE =====
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue || (multiple ? [] : undefined));
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState('bottom');
    const [searchValue, setSearchValue] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);

    const searchInputRef = useRef(null);
    const selectRef = useRef(null);

    // Current value
    const currentValue = isControlled ? value : internalValue;

    // ===== DERIVED DATA =====

    // Filter options based on search
    const filteredOptions = useMemo(() => {
        return filterOptions(options, searchValue, filterOption);
    }, [options, searchValue, filterOption]);

    // Display label for single select
    const displayLabel = useMemo(() => {
        if (multiple) return null;
        if (!currentValue) return null;

        const option = options.find(o => o.value === currentValue);
        return option?.label || currentValue;
    }, [currentValue, options, multiple]);

    // Display tags for multi-select
    const displayTags = useMemo(() => {
        if (!multiple) return [];
        if (!Array.isArray(currentValue)) return [];

        const tags = currentValue.map(val => {
            const option = options.find(o => o.value === val);
            return { value: val, label: option?.label || val };
        });

        if (maxTagCount && tags.length > maxTagCount) {
            return tags.slice(0, maxTagCount);
        }
        return tags;
    }, [currentValue, options, multiple, maxTagCount]);

    // Hidden tags count
    const hiddenTagsCount = useMemo(() => {
        if (!multiple || !maxTagCount || !Array.isArray(currentValue)) return 0;
        return Math.max(0, currentValue.length - maxTagCount);
    }, [multiple, maxTagCount, currentValue]);

    // ===== HANDLERS =====

    const updateValue = useCallback((newValue) => {
        if (!isControlled) {
            setInternalValue(newValue);
        }
        onChange?.(newValue);
    }, [isControlled, onChange]);

    const openDropdown = useCallback(() => {
        if (disabled || isOpen) return;
        if (selectRef.current) {
            const rect = selectRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < 260 && spaceAbove > spaceBelow) {
                setPlacement('top');
            } else {
                setPlacement('bottom');
            }
        }
        setIsOpen(true);
        onOpenChange?.(true);
    }, [disabled, isOpen, onOpenChange]);

    const closeDropdown = useCallback(() => {
        if (!isOpen) return;
        setIsOpen(false);
        setSearchValue('');
        setHighlightedIndex(-1);
        onOpenChange?.(false);
    }, [isOpen, onOpenChange]);

    const toggleDropdown = useCallback(() => {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }, [isOpen, closeDropdown, openDropdown]);

    // Select an option
    const handleOptionSelect = useCallback((option) => {
        if (multiple) {
            const currentArray = Array.isArray(currentValue) ? currentValue : [];
            const isSelected = currentArray.includes(option.value);

            const newValue = isSelected
                ? currentArray.filter(v => v !== option.value)
                : [...currentArray, option.value];

            updateValue(newValue);
            // Keep dropdown open for multi-select
        } else {
            updateValue(option.value);
            closeDropdown();
        }
    }, [multiple, currentValue, updateValue, closeDropdown]);

    // Clear selection
    const handleClear = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        updateValue(multiple ? [] : undefined);
        setSearchValue('');
        onSearch?.('');
    }, [multiple, updateValue, onSearch]);

    // Remove a tag (multi-select)
    const handleRemoveTag = useCallback((valueToRemove, e) => {
        e.preventDefault();
        e.stopPropagation();

        const newValue = Array.isArray(currentValue)
            ? currentValue.filter(v => v !== valueToRemove)
            : [];

        updateValue(newValue);
    }, [currentValue, updateValue]);

    // Search change
    const handleSearchChange = useCallback((e) => {
        const val = e.target.value;
        setSearchValue(val);
        setHighlightedIndex(0);
        onSearch?.(val);
    }, [onSearch]);

    // ===== EFFECTS =====

    // Auto-highlight first option when dropdown opens
    useEffect(() => {
        if (isOpen && filteredOptions.length > 0) {
            setHighlightedIndex(0);
        }
    }, [isOpen, filteredOptions.length]);

    // Focus search input when dropdown opens and searchable
    useEffect(() => {
        if (isOpen && canSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, canSearch]);

    // Click outside to close
    const clickOutsideRef = useClickOutside(useCallback(() => {
        if (isOpen) {
            closeDropdown();
            setIsFocused(false);
        }
    }, [isOpen, closeDropdown]));

    // Keyboard navigation
    const { handleKeyDown } = useKeyboardNav({
        isOpen,
        onOpen: openDropdown,
        onClose: closeDropdown,
        options: filteredOptions,
        highlightedIndex,
        setHighlightedIndex,
        onSelect: handleOptionSelect,
        searchable: canSearch,
    });

    // ===== IMPERATIVE HANDLE =====
    useImperativeHandle(ref, () => ({
        focus: () => selectRef.current?.focus(),
        blur: () => selectRef.current?.blur(),
        open: openDropdown,
        close: closeDropdown,
        clear: () => updateValue(multiple ? [] : undefined),
    }));

    // ===== CLASSES =====
    const wrapperClasses = useMemo(() => {
        return [
            styles.selectWrapper,
            styles[`size-${size}`],
            styles[`variant-${variant}`],
            isFocused && styles.focused,
            isOpen && styles.open,
            disabled && styles.disabled,
            status === 'error' && styles.error,
            status === 'warning' && styles.warning,
            multiple && styles.multiple,
            className,
        ].filter(Boolean).join(' ');
    }, [size, variant, isFocused, isOpen, disabled, status, multiple, className]);

    // ===== RENDER =====

    // Check if we should show the search input inline (multi-select with tags)
    const showInlineSearch = multiple && canSearch;
    const showPlaceholder = multiple
        ? (!currentValue || currentValue.length === 0) && !searchValue
        : !displayLabel && !searchValue;

    return (
        <div
            ref={clickOutsideRef}
            className={wrapperClasses}
            style={style}
        >
            {/* Main Select Box */}
            <div
                ref={selectRef}
                className={styles.selectBox}
                onClick={toggleDropdown}
                onKeyDown={handleKeyDown}
                tabIndex={disabled ? -1 : 0}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={ariaLabel}
                aria-disabled={disabled}
                id={id}
            >
                {prefix && <span className={styles.prefix}>{prefix}</span>}

                {/* Content Area */}
                <div className={styles.content}>
                    {/* Multi-select Tags */}
                    {multiple && displayTags.map(tag => (
                        <span key={tag.value} className={styles.tag}>
                            <span className={styles.tagLabel}>{tag.label}</span>
                            {!disabled && (
                                <span
                                    className={styles.tagRemove}
                                    onClick={(e) => handleRemoveTag(tag.value, e)}
                                    role="button"
                                    aria-label={`Remove ${tag.label}`}
                                >
                                    ✕
                                </span>
                            )}
                        </span>
                    ))}

                    {/* Hidden tags count */}
                    {hiddenTagsCount > 0 && (
                        <span className={styles.tag}>
                            <span className={styles.tagLabel}>
                                {maxTagPlaceholder
                                    ? maxTagPlaceholder(hiddenTagsCount)
                                    : `+${hiddenTagsCount}`}
                            </span>
                        </span>
                    )}

                    {/* Search Input or Placeholder */}
                    {canSearch && (isOpen || showInlineSearch) ? (
                        <input
                            ref={searchInputRef}
                            type="text"
                            className={styles.searchInput}
                            value={searchValue}
                            onChange={handleSearchChange}
                            onKeyDown={handleKeyDown}
                            placeholder={showPlaceholder ? placeholder : ''}
                            disabled={disabled}
                            onClick={(e) => e.stopPropagation()}
                            autoComplete="off"
                            name={name}
                        />
                    ) : (
                        <>
                            {showPlaceholder ? (
                                <span className={styles.placeholder}>{placeholder}</span>
                            ) : (
                                !multiple && <span className={styles.selectedValue}>{displayLabel}</span>
                            )}
                        </>
                    )}
                </div>

                {/* Icons Area */}
                <div className={styles.iconsArea}>
                    {/* Clear Button */}
                    {allowClear && currentValue && (multiple ? currentValue.length > 0 : currentValue) && !disabled && (
                        <span
                            className={styles.clearButton}
                            onClick={handleClear}
                            role="button"
                            tabIndex={-1}
                            aria-label="Clear selection"
                        >
                            ✕
                        </span>
                    )}

                    {/* Loading Spinner */}
                    {loading && (
                        <span className={styles.loadingIcon}>⟳</span>
                    )}

                    {/* Suffix */}
                    {suffix && <span className={styles.suffix}>{suffix}</span>}

                    {/* Arrow */}
                    <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                        </svg>
                    </span>
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className={`${styles.dropdown} ${placement === 'top' ? styles.dropdownTop : ''} ${dropdownClassName || ''}`}
                    style={{
                        ...(dropdownMatchSelectWidth ? { width: '100%' } : {}),
                        ...dropdownStyle,
                    }}
                    role="listbox"
                >
                    {loading ? (
                        <div className={styles.loadingState}>
                            <span className={styles.spinner}>⟳</span>
                            <span>Loading...</span>
                        </div>
                    ) : filteredOptions.length === 0 ? (
                        <div className={styles.notFound}>
                            {notFoundContent}
                        </div>
                    ) : (
                        <div className={styles.optionsList}>
                            {filteredOptions.map((option, index) => (
                                <SelectOption
                                    key={option.value}
                                    option={option}
                                    isSelected={isOptionSelected(option, currentValue, multiple)}
                                    isHighlighted={index === highlightedIndex}
                                    onClick={handleOptionSelect}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    multiple={multiple}
                                    renderOption={renderOption}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

Select.displayName = 'Select';

export default Select;
