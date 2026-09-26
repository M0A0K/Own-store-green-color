import React, { useState } from 'react';
import { Eye, Code2 } from 'lucide-react';

function renderInlineTokens(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#FAF5F6]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key++} className="italic text-stone-200">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-[#090708] border border-[#2C1A1E] font-mono text-xs text-red-400"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const SafeMarkdown: React.FC<{ content: string; className?: string }> = React.memo(
  ({ content, className = '' }) => {
    if (!content || !content.trim()) {
      return <p className="text-sm text-stone-400">No detailed description provided.</p>;
    }

    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h4
            key={i}
            className="text-base font-semibold text-[#FAF5F6] mt-5 mb-2 tracking-tight"
          >
            {renderInlineTokens(line.slice(4))}
          </h4>
        );
        i++;
        continue;
      }

      if (line.startsWith('## ')) {
        elements.push(
          <h3
            key={i}
            className="text-lg font-bold text-[#FAF5F6] mt-6 mb-2.5 tracking-tight border-b border-[#2C1A1E] pb-2"
          >
            {renderInlineTokens(line.slice(3))}
          </h3>
        );
        i++;
        continue;
      }

      if (line.startsWith('# ')) {
        elements.push(
          <h2
            key={i}
            className="text-xl font-bold text-[#FAF5F6] mt-6 mb-3 tracking-tight"
          >
            {renderInlineTokens(line.slice(2))}
          </h2>
        );
        i++;
        continue;
      }

      // Markdown Table
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableRows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const rowText = lines[i].trim();
          const cells = rowText
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) {
            tableRows.push(cells);
          }
          i++;
        }

        if (tableRows.length > 0) {
          const header = tableRows[0];
          const body = tableRows.slice(1);
          elements.push(
            <div
              key={`table-${i}`}
              className="my-4 overflow-x-auto rounded-lg border border-[#2C1A1E]"
            >
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#090708] border-b border-[#2C1A1E]">
                    {header.map((h, idx) => (
                      <th key={idx} className="px-3.5 py-2.5 font-semibold text-stone-200">
                        {renderInlineTokens(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C1A1E]/70">
                  {body.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/[0.02]">
                      {r.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3.5 py-2 text-stone-300 font-mono text-xs tabular-nums"
                        >
                          {renderInlineTokens(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const items: string[] = [];
        while (
          i < lines.length &&
          (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
        ) {
          items.push(lines[i].trim().slice(2));
          i++;
        }
        elements.push(
          <ul
            key={`ul-${i}`}
            className="my-3 space-y-1.5 pl-4 list-disc text-sm text-stone-300"
          >
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInlineTokens(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
          i++;
        }
        elements.push(
          <ol
            key={`ol-${i}`}
            className="my-3 space-y-1.5 pl-4 list-decimal text-sm text-stone-300"
          >
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInlineTokens(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={i}
            className="my-3 pl-3.5 border-l-2 border-red-500 text-sm italic text-stone-300"
          >
            {renderInlineTokens(line.slice(2))}
          </blockquote>
        );
        i++;
        continue;
      }

      // Paragraph
      elements.push(
        <p key={i} className="my-2.5 text-sm text-stone-300 leading-relaxed">
          {renderInlineTokens(line)}
        </p>
      );
      i++;
    }

    return <div className={`space-y-1 ${className}`}>{elements}</div>;
  }
);

export const MarkdownEditorWithPreview: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}> = ({ label, value, onChange, rows = 7 }) => {
  const [mode, setMode] = useState<'split' | 'edit' | 'preview'>('split');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-stone-300">{label}</label>
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-[#090708] border border-[#2C1A1E]">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
              mode === 'edit'
                ? 'bg-[#181013] text-white font-medium'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3 h-3 inline mr-1" />
            Markdown
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
              mode === 'split'
                ? 'bg-[#181013] text-white font-medium'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Live Split
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
              mode === 'preview'
                ? 'bg-[#181013] text-white font-medium'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3 inline mr-1" />
            Preview
          </button>
        </div>
      </div>

      <div
        className={`grid gap-3 ${
          mode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Supports ## Headings, **Bold**, `commands`, - bullet lists, and | tables |..."
            className="w-full rounded-lg bg-[#090708] border border-[#2C1A1E] px-3.5 py-2.5 text-xs font-mono text-stone-200 focus:outline-none focus:border-red-500"
          />
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className="rounded-lg bg-[#090708]/90 border border-[#2C1A1E] p-3.5 max-h-64 overflow-y-auto">
            <div className="text-[11px] text-stone-500 mb-2 border-b border-[#2C1A1E] pb-1">
              Safe Markdown Live Preview
            </div>
            <SafeMarkdown content={value} />
          </div>
        )}
      </div>
    </div>
  );
};
