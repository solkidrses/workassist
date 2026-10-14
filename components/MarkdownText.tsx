'use client'

import React, { useState, useMemo, memo, useEffect } from 'react';
import { createPortal } from 'react-dom';

function PhotoOverlay({ src, onClose }: { src: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'page-enter 0.2s ease both',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Full photo" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
    </div>,
    document.body
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length < 2) return text;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (part.toLowerCase() === q.toLowerCase()) {
      return (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
}

function parseInline(
  text: string,
  onPhotoClick: (src: string) => void,
  imageSize: 'thumb' | 'full',
  highlightQuery?: string,
  keyPrefix = 'inline'
): React.ReactNode[] {
  const tokenRegex = /(!\[([^\]]*)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const plain = text.slice(lastIdx, match.index);
      nodes.push(
        <React.Fragment key={`${keyPrefix}-txt-${key++}`}>
          {highlightQuery ? highlightText(plain, highlightQuery) : plain}
        </React.Fragment>
      );
    }

    if (match[1]) {
      // Standalone/inline image
      const alt = match[2];
      const src = match[3];
      nodes.push(
        <span
          key={`${keyPrefix}-img-${key++}`}
          style={{
            display: imageSize === 'full' ? 'block' : 'inline-block',
            verticalAlign: 'middle',
            margin: '6px 0',
            borderRadius: 8,
            overflow: 'hidden',
            width: imageSize === 'full' ? '100%' : 110,
            height: imageSize === 'full' ? 'auto' : 110,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onClick={() => onPhotoClick(src)}
            style={{
              width: '100%',
              height: imageSize === 'full' ? 'auto' : '100%',
              objectFit: imageSize === 'full' ? 'contain' : 'cover',
              cursor: 'pointer',
              display: 'block',
              borderRadius: 8,
            }}
          />
        </span>
      );
    } else if (match[4]) {
      // Bold text
      const boldContent = match[5];
      nodes.push(
        <strong key={`${keyPrefix}-bld-${key++}`} style={{ fontWeight: 600, color: 'var(--text-main)' }}>
          {highlightQuery ? highlightText(boldContent, highlightQuery) : boldContent}
        </strong>
      );
    } else if (match[6]) {
      // Code snippet
      const codeContent = match[7];
      nodes.push(
        <code
          key={`${keyPrefix}-code-${key++}`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 13,
            fontFamily: 'monospace',
          }}
        >
          {highlightQuery ? highlightText(codeContent, highlightQuery) : codeContent}
        </code>
      );
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    const plain = text.slice(lastIdx);
    nodes.push(
      <React.Fragment key={`${keyPrefix}-txt-${key++}`}>
        {highlightQuery ? highlightText(plain, highlightQuery) : plain}
      </React.Fragment>
    );
  }

  return nodes;
}

export function splitIntoBlocks(text: string): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/);
  const blocks: string[] = [];

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let currentBlock = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      const isHeader = /^#{1,6}\s+/.test(trimmedLine);
      const isListItem = /^([*+-]|\d+[.)]|•)\s+/.test(trimmedLine);
      const isImg = /^!\[([^\]]*)\]\(([^)]+)\)$/.test(trimmedLine);

      if (isHeader || isImg) {
        if (currentBlock.trim()) {
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        blocks.push(trimmedLine);
      } else if (isListItem) {
        if (currentBlock.trim()) {
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        currentBlock = line;
      } else {
        if (currentBlock) {
          currentBlock += '\n' + line;
        } else {
          currentBlock = line;
        }
      }
    }

    if (currentBlock.trim()) {
      blocks.push(currentBlock.trim());
    }
  }

  return blocks;
}

function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (q.length < 2) return true;
  return text.toLowerCase().includes(q);
}

function renderBlockContent(
  block: string,
  onPhotoClick: (src: string) => void,
  imageSize: 'thumb' | 'full',
  highlightQuery?: string
): React.ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Standalone image block
  const singleImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (singleImgMatch) {
    const alt = singleImgMatch[1];
    const src = singleImgMatch[2];
    const imgStyle: React.CSSProperties =
      imageSize === 'full'
        ? { width: '100%', height: 'auto', borderRadius: 10, cursor: 'pointer', display: 'block' }
        : { width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' };
    const wrapperStyle =
      imageSize === 'full'
        ? { margin: '10px 0', borderRadius: 10, overflow: 'hidden' }
        : { margin: '10px 0', borderRadius: 10, overflow: 'hidden', width: 120, height: 120 };

    return (
      <div style={wrapperStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onClick={() => onPhotoClick(src)}
          style={imgStyle}
        />
      </div>
    );
  }

  // Heading check (#, ##, ###)
  const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const headingText = headingMatch[2];
    const fontSize = level === 1 ? 18 : level === 2 ? 16 : 15;
    return (
      <div style={{ fontWeight: 600, fontSize, color: 'var(--text-main)', margin: '4px 0 6px 0' }}>
        {parseInline(headingText, onPhotoClick, imageSize, highlightQuery)}
      </div>
    );
  }

  // Paragraph / multi-line block
  const lines = trimmed.split('\n');
  const paragraphChildren: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      paragraphChildren.push(<br key={`br-${lineIdx}`} />);
    }
    const inlineNodes = parseInline(line, onPhotoClick, imageSize, highlightQuery, `ln-${lineIdx}`);
    paragraphChildren.push(...inlineNodes);
  });

  return (
    <div style={{ lineHeight: 1.65, wordBreak: 'break-word' }}>
      {paragraphChildren}
    </div>
  );
}

function renderMarkdown(
  text: string,
  onPhotoClick: (src: string) => void,
  imageSize: 'thumb' | 'full',
  highlightQuery?: string,
  onClearSearch?: () => void
): { elements: React.ReactNode; matchCount: number } {
  if (!text) return { elements: null, matchCount: 0 };

  const query = highlightQuery?.trim() || '';
  const isFiltering = query.length >= 2;

  if (isFiltering) {
    const allBlocks = splitIntoBlocks(text);
    const matchedBlocks = allBlocks.filter(b => matchesSearch(b, query));

    if (matchedBlocks.length === 0) {
      return {
        elements: (
          <div
            style={{
              textAlign: 'center',
              padding: '36px 16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 12,
              margin: '12px 0',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-main)', marginBottom: 6 }}>
              По запросу «<span style={{ color: 'var(--accent)' }}>{query}</span>» ничего не найдено
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Попробуйте ввести другое ключевое слово
            </div>
            {onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                Показать всю инструкцию
              </button>
            )}
          </div>
        ),
        matchCount: 0,
      };
    }

    return {
      elements: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0' }}>
          {matchedBlocks.map((block, idx) => (
            <div
              key={`match-${query}-${idx}`}
              className="filtered-record-card"
              style={{
                ['--record-index' as string]: idx,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--accent)',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Запись {idx + 1}
                </span>
              </div>
              <div>{renderBlockContent(block, onPhotoClick, imageSize, query)}</div>
            </div>
          ))}
        </div>
      ),
      matchCount: matchedBlocks.length,
    };
  }

  // Default normal mode: render all raw blocks as standard markdown
  const rawBlocks = text.split(/\n\s*\n/);
  const elements: React.ReactNode[] = [];
  let blockKey = 0;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    elements.push(
      <div key={blockKey++} style={{ marginBottom: 12 }}>
        {renderBlockContent(block, onPhotoClick, imageSize, undefined)}
      </div>
    );
  }

  return { elements, matchCount: 0 };
}

export interface MarkdownTextProps {
  content: string;
  imageSize?: 'thumb' | 'full';
  highlightQuery?: string;
  onClearSearch?: () => void;
  onMatchesCountChange?: (count: number) => void;
}

function MarkdownText({
  content,
  imageSize = 'thumb',
  highlightQuery,
  onClearSearch,
  onMatchesCountChange,
}: MarkdownTextProps) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  const { elements, matchCount } = useMemo(
    () => renderMarkdown(content, setPhotoSrc, imageSize, highlightQuery, onClearSearch),
    [content, imageSize, highlightQuery, onClearSearch]
  );

  useEffect(() => {
    if (onMatchesCountChange) {
      onMatchesCountChange(matchCount);
    }
  }, [matchCount, onMatchesCountChange]);

  return (
    <>
      {elements}
      {photoSrc && <PhotoOverlay src={photoSrc} onClose={() => setPhotoSrc(null)} />}
    </>
  );
}

export default memo(MarkdownText);
