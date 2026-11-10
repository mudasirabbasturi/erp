/**
 * Standardizes any media path or relative upload path into a valid URL
 * that loads cleanly in the browser.
 */
export const getMediaUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    // Remove leading slash if any, then prepend '/'
    const clean = filePath.replace(/^\/+/, '');
    // Ensure path is URI-encoded so spaces and special characters are safely handled by fetch and img tags
    const segments = clean.split('/');
    const encoded = segments.map(seg => encodeURIComponent(decodeURIComponent(seg))).join('/');
    return `/${encoded}`;
};

