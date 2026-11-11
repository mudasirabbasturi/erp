export const AI_PROVIDER_MODELS = {
    gemini: {
        label: 'Google Gemini',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
    },
    claude: {
        label: 'Anthropic Claude',
        models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
    },
    chatgpt: {
        label: 'OpenAI ChatGPT',
        models: ['gpt-4.1', 'gpt-4o', 'o3-mini', 'gpt-4o-mini']
    },
    deepseek: {
        label: 'DeepSeek AI',
        models: ['deepseek-chat', 'deepseek-reasoner']
    },
    groq: {
        label: 'Groq (Ultra-Fast)',
        models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b', 'openai/gpt-oss-20b']
    }
};

export const renderAIMarkdown = (text) => {
    if (!text) return '';

    let html = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Fenced code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e293b; color:#f8fafc; padding:12px; border-radius:8px; overflow-x:auto; margin:8px 0; font-size:12px;"><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; color:#be123c; padding:2px 6px; border-radius:4px; font-size:12px;">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Generated / embedded images ![alt](url) MUST run before normal links
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
        return `<div style="margin:10px 0;"><img src="${src}" alt="${alt}" style="max-width:100%; max-height:380px; border-radius:10px; border:1px solid #cbd5e1; box-shadow:0 4px 12px rgba(15,23,42,0.08); display:block;" /><div style="margin-top:4px; font-size:11px; color:#64748b;"><a href="${src}" download target="_blank" rel="noopener noreferrer" style="color:#4f46e5; font-weight:600; text-decoration:none;">Download Image</a></div></div>`;
    });

    // Links [text](url) — turn /uploads/ai_exports/ files into clean download buttons
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
        if (href.includes('/uploads/ai_exports/') || /\.(pdf|xlsx|csv)$/i.test(href)) {
            const isPdf = href.toLowerCase().endsWith('.pdf');
            const bg = isPdf ? '#fef2f2' : '#ecfdf5';
            const border = isPdf ? '#fecaca' : '#a7f3d0';
            const color = isPdf ? '#b91c1c' : '#047857';
            const icon = isPdf ? '📄' : '📊';
            return `<a href="${href}" download target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:6px; padding:7px 14px; margin:4px 0; border-radius:8px; background:${bg}; border:1px solid ${border}; color:${color}; font-weight:700; font-size:12.5px; text-decoration:none;">${icon} ${label}</a>`;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5; font-weight:600; text-decoration:underline;">${label}</a>`;
    });

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:15px; font-weight:800; margin:12px 0 6px; color:#0f172a;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:17px; font-weight:800; margin:14px 0 8px; color:#0f172a;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:19px; font-weight:800; margin:16px 0 10px; color:#0f172a;">$1</h1>');

    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr style="border:none; border-top:1px solid #e2e8f0; margin:10px 0;" />');

    // Markdown tables
    if (html.includes('|')) {
        const lines = html.split('\n');
        let inTable = false;
        let tableHtml = '<div style="overflow-x:auto; margin:10px 0;"><table style="width:100%; border-collapse:collapse; font-size:12.5px;">';
        const newLines = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
                if (!inTable) {
                    inTable = true;
                    tableHtml += '<thead><tr>' + cells.map((c) => `<th style="background:#f1f5f9; padding:7px 10px; border:1px solid #e2e8f0; font-weight:700; text-align:left;">${c}</th>`).join('') + '</tr></thead><tbody>';
                } else if (/^[\s|:-]+$/.test(trimmed)) {
                    continue;
                } else {
                    tableHtml += '<tr>' + cells.map((c) => `<td style="padding:7px 10px; border:1px solid #e2e8f0; background:#fff;">${c}</td>`).join('') + '</tr>';
                }
            } else {
                if (inTable) {
                    inTable = false;
                    tableHtml += '</tbody></table></div>';
                    newLines.push(tableHtml);
                    tableHtml = '<div style="overflow-x:auto; margin:10px 0;"><table style="width:100%; border-collapse:collapse; font-size:12.5px;">';
                }
                newLines.push(line);
            }
        }
        if (inTable) {
            tableHtml += '</tbody></table></div>';
            newLines.push(tableHtml);
        }
        html = newLines.join('\n');
    }

    // Bullet lists
    html = html.replace(/^[-*] (.*)$/gim, '<div style="display:flex; gap:6px; margin:3px 0;"><span style="color:#4f46e5;">•</span><span>$1</span></div>');

    // Paragraphs & line breaks
    html = html.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
    return html;
};

