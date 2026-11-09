import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import ini from 'highlight.js/lib/languages/ini';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import javascript from 'highlight.js/lib/languages/javascript';
import plaintext from 'highlight.js/lib/languages/plaintext';

// Nur die Sprachen, die in Prüfungsinhalten vorkommen (hält das Bundle klein)
const languages = { bash, shell, powershell, dos, python, sql, ini, json, yaml, xml, javascript, plaintext };
const rehypePlugins: never[] = [[rehypeHighlight, { languages, detect: false, ignoreMissing: true }]] as never[];
const remarkPlugins = [remarkGfm];

export const Markdown = memo(function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {children}
      </ReactMarkdown>
    </div>
  );
});

/** Lückentext: {{Lösung}} → Lücke bzw. hervorgehobene Lösung (als Markdown-HTML-freie Variante) */
export function clozeToMarkdown(text: string, reveal: boolean): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, ans: string) => (reveal ? `**⟨${ans}⟩**` : '`［ … ］`'));
}
