// Filter options based on search query
export const filterOptions = (options, searchValue, filterOption) => {
    if (!searchValue) return options;

    if (filterOption) {
        return options.filter(option => filterOption(searchValue, option));
    }

    return options.filter(option => {
        const label = String(option.label || '').toLowerCase();
        const value = String(option.value || '').toLowerCase();
        const query = searchValue.toLowerCase();
        return label.includes(query) || value.includes(query);
    });
};

// Check if option is selected
export const isOptionSelected = (option, value, multiple) => {
    if (multiple) {
        return Array.isArray(value) && value.some(v =>
            typeof v === 'object' ? v.value === option.value : v === option.value
        );
    }
    return typeof value === 'object'
        ? value?.value === option.value
        : value === option.value;
};

// Get label from value
export const getLabel = (value, options) => {
    if (!value) return '';
    const option = options.find(o => o.value === value);
    return option?.label || value;
};

// Group options by their group
export const groupOptions = (options) => {
    const grouped = {};
    const ungrouped = [];

    options.forEach(option => {
        if (option.group) {
            if (!grouped[option.group]) {
                grouped[option.group] = [];
            }
            grouped[option.group].push(option);
        } else {
            ungrouped.push(option);
        }
    });

    return { grouped, ungrouped };
};