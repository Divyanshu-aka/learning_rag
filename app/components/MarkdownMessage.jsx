'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodeBlock({ language, children }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(String(children));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-3">
            <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-md border-b border-gray-600">
                <span className="text-xs text-gray-400 font-mono">{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                    {copied ? (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                className="!mt-0 !rounded-t-none !rounded-b-md overflow-x-auto"
                showLineNumbers={true}
            >
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        </div>
    );
}

export default function MarkdownMessage({ content }) {
    return (
        <div className="prose prose-invert max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom code block rendering with syntax highlighting
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                            <CodeBlock language={match[1]}>{children}</CodeBlock>
                        ) : (
                            <code className="bg-gray-600 px-1.5 py-0.5 rounded text-sm text-blue-300 font-mono" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Custom paragraph styling
                    p({ children }) {
                        return <p className="mb-2 text-gray-100 leading-relaxed">{children}</p>;
                    },
                    // Custom heading styles
                    h1({ children }) {
                        return <h1 className="text-xl font-bold mb-3 mt-4 text-white border-b border-gray-600 pb-2">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="text-lg font-semibold mb-2 mt-3 text-white">{children}</h2>;
                    },
                    h3({ children }) {
                        return <h3 className="text-base font-semibold mb-2 mt-2 text-gray-200">{children}</h3>;
                    },
                    // Custom list styles
                    ul({ children }) {
                        return <ul className="list-disc list-inside mb-2 space-y-1 text-gray-100 ml-2">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-100 ml-2">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="ml-2 leading-relaxed">{children}</li>;
                    },
                    // Custom blockquote style
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-3 italic bg-blue-500/10 rounded-r text-gray-200">
                                {children}
                            </blockquote>
                        );
                    },
                    // Custom link style
                    a({ href, children }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline decoration-blue-500/50 hover:decoration-blue-300"
                            >
                                {children}
                            </a>
                        );
                    },
                    // Custom table styles
                    table({ children }) {
                        return (
                            <div className="overflow-x-auto my-3 rounded-md border border-gray-600">
                                <table className="min-w-full">{children}</table>
                            </div>
                        );
                    },
                    thead({ children }) {
                        return <thead className="bg-gray-700/50">{children}</thead>;
                    },
                    tbody({ children }) {
                        return <tbody className="divide-y divide-gray-600">{children}</tbody>;
                    },
                    th({ children }) {
                        return <th className="px-4 py-2 text-left text-white font-semibold text-sm">{children}</th>;
                    },
                    td({ children }) {
                        return <td className="px-4 py-2 text-gray-100 text-sm">{children}</td>;
                    },
                    tr({ children }) {
                        return <tr className="hover:bg-gray-700/30 transition-colors">{children}</tr>;
                    },
                    // Custom horizontal rule
                    hr() {
                        return <hr className="my-4 border-gray-600" />;
                    },
                    // Custom strong/bold
                    strong({ children }) {
                        return <strong className="font-bold text-white">{children}</strong>;
                    },
                    // Custom emphasis/italic
                    em({ children }) {
                        return <em className="italic text-gray-200">{children}</em>;
                    },
                    // Custom delete/strikethrough
                    del({ children }) {
                        return <del className="line-through text-gray-400">{children}</del>;
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
