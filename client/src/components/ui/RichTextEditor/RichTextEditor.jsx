import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import styles from './RichTextEditor.module.css';

const DEFAULT_MODULES = {
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        ['link', 'clean']
    ]
};

const DEFAULT_FORMATS = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list',
    'color', 'background',
    'link'
];

/**
 * RichTextEditor - Standard rich text input powered by react-quill-new
 * Follows Adobe Clean typography and provides a responsive, accessible toolbar.
 */
const RichTextEditor = ({
    value = '',
    onChange,
    placeholder = 'Write here...',
    readOnly = false,
    minHeight = 110,
    isPrivate = false,
    className = ''
}) => {
    const wrapperClass = [
        styles.editorWrapper,
        readOnly ? styles.readOnlyWrapper : '',
        isPrivate ? styles.privateTheme : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={wrapperClass} style={{ '--editor-min-height': `${minHeight}px` }}>
            <ReactQuill
                theme="snow"
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
                readOnly={readOnly}
                modules={readOnly ? { toolbar: false } : DEFAULT_MODULES}
                formats={DEFAULT_FORMATS}
            />
        </div>
    );
};

export default RichTextEditor;

