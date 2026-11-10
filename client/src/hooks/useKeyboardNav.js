import { useCallback } from 'react';

export const useKeyboardNav = ({
    isOpen,
    onOpen,
    onClose,
    options,
    highlightedIndex,
    setHighlightedIndex,
    onSelect,
    searchable,
    onSearchChange,
}) => {

    const handleKeyDown = useCallback((e) => {
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
            e.preventDefault();
            onOpen();
            return;
        }

        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < options.length - 1 ? prev + 1 : 0
                );
                break;

            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev > 0 ? prev - 1 : options.length - 1
                );
                break;

            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && options[highlightedIndex]) {
                    onSelect(options[highlightedIndex]);
                }
                break;

            case 'Escape':
                e.preventDefault();
                onClose();
                break;

            case 'Tab':
                onClose();
                break;

            case 'Home':
                if (!searchable) {
                    e.preventDefault();
                    setHighlightedIndex(0);
                }
                break;

            case 'End':
                if (!searchable) {
                    e.preventDefault();
                    setHighlightedIndex(options.length - 1);
                }
                break;

            case 'Backspace':
                // For multi-select, remove last tag on backspace
                if (e.target.value === '') {
                    // Parent will handle
                }
                break;

            default:
                break;
        }
    }, [isOpen, options, highlightedIndex, setHighlightedIndex, onSelect, onClose, onOpen, searchable]);

    return { handleKeyDown };
};