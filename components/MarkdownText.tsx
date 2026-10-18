'use client'

import React, { useState, useMemo, memo, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { useAccessCheck } from '@/lib/AccessProvider';

function resolvePhotoUrl(src: string, initData?: string): string {
  if (!src || typeof src !== 'string') return src;
  if (!src.startsWith('/api/photos/')) return src;
  if (src.includes('sig=') || src.includes('initData=')) return src;
  if (initData) {
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}initData=${encodeURIComponent(initData)}`;
  }
  return src;
}

const subscribeNoop = () => () => {};

function PhotoOverlay({ src, onClose }: { src: string; onClose: () => void }) {
  // Классический is-client снапшот без setState в effect
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useEffect(() => {
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
  keyPrefix = 'inline',
  initData?: string
): React.ReactNode[] {
  // Matches:
  // 1: Markdown image ![alt](url)
  // 4: HTML image <img ... src="..." ... />
  // 6: Bold **text**
  // 8: Code `code`
  const tokenRegex = /(!\[([^\]]*)\]\(([^)]+)\))|(<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>)|(\*\*([^*]+)\*\*)|(`([^`]+)`)/gi;
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

    if (match[1] || match[4]) {
      // Standalone/inline image (Markdown or HTML)
      let alt = '';
      let rawSrc = '';
      if (match[1]) {
        alt = match[2];
        rawSrc = match[3];
      } else if (match[4]) {
        rawSrc = match[5];
        const altMatch = match[4].match(/\balt=["']([^"']*)["']/i);
        alt = altMatch ? altMatch[1] : '';
      }
      const src = resolvePhotoUrl(rawSrc, initData);

      nodes.push(
        <span
          key={`${keyPrefix}-img-${key++}`}
          style={{
            display: imageSize === 'full' ? 'block' : 'inline-block',
            verticalAlign: 'middle',
            margin: '8px 0',
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
            onClick={(e) => { e.stopPropagation(); onPhotoClick(src); }}
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
    } else if (match[6]) {
      // Bold text
      const boldContent = match[7];
      nodes.push(
        <strong key={`${keyPrefix}-bld-${key++}`} style={{ fontWeight: 600, color: 'var(--text-main)' }}>
          {highlightQuery ? highlightText(boldContent, highlightQuery) : boldContent}
        </strong>
      );
    } else if (match[8]) {
      // Code snippet
      const codeContent = match[9];
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
      const isImg = /^(!\[([^\]]*)\]\(([^)]+)\)|<img\b[^>]*?\bsrc=["'][^"']+["'][^>]*?>)/i.test(trimmedLine);

      if (isHeader) {
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
      } else if (isImg) {
        // Прикрепляем скриншот к текущему шагу/абзацу, чтобы при поиске по тексту шага скриншот не отбрасывался!
        if (currentBlock.trim()) {
          currentBlock += '\n' + trimmedLine;
        } else {
          currentBlock = trimmedLine;
        }
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

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// Каждому структурному блоку (из splitIntoBlocks) сопоставляем индекс абзаца
// полной инструкции (разбитие по пустым строкам). Нужно, чтобы карточка поиска
// знала, к какому месту полной версии прыгать.
function buildParaIndexOfBlock(text: string): number[] {
  const rawParas = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const collapsedParas = rawParas.map(collapseWs);
  const allBlocks = splitIntoBlocks(text);
  const paraIndexOf: number[] = [];
  let p = 0;
  for (const block of allBlocks) {
    const cb = collapseWs(block);
    while (p < collapsedParas.length && !collapsedParas[p].includes(cb)) p++;
    paraIndexOf.push(Math.min(p, collapsedParas.length - 1));
  }
  return paraIndexOf;
}

function renderBlockContent(
  block: string,
  onPhotoClick: (src: string) => void,
  imageSize: 'thumb' | 'full',
  highlightQuery?: string,
  initData?: string
): React.ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Standalone image block (Markdown or HTML)
  const singleImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  const singleHtmlImgMatch = !singleImgMatch ? trimmed.match(/^<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>$/i) : null;

  if (singleImgMatch || singleHtmlImgMatch) {
    let alt = '';
    let rawSrc = '';
    if (singleImgMatch) {
      alt = singleImgMatch[1];
      rawSrc = singleImgMatch[2];
    } else if (singleHtmlImgMatch) {
      rawSrc = singleHtmlImgMatch[1];
      const altMatch = singleHtmlImgMatch[0].match(/\balt=["']([^"']*)["']/i);
      alt = altMatch ? altMatch[1] : '';
    }
    const src = resolvePhotoUrl(rawSrc, initData);

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
          onClick={(e) => { e.stopPropagation(); onPhotoClick(src); }}
          style={imgStyle}
        />
      </div>
    );
  }

  // Heading check (#, ##, ###) for single-line heading blocks
  const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch && !trimmed.includes('\n')) {
    const level = headingMatch[1].length;
    const headingText = headingMatch[2];
    const fontSize = level === 1 ? 18 : level === 2 ? 16 : 15;
    return (
      <div style={{ fontWeight: 600, fontSize, color: 'var(--text-main)', margin: '4px 0 6px 0' }}>
        {parseInline(headingText, onPhotoClick, imageSize, highlightQuery, 'inline', initData)}
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
    const trimmedLine = line.trim();
    // Check if individual line inside block is a heading
    const lineHeadingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
    if (lineHeadingMatch) {
      const level = lineHeadingMatch[1].length;
      const headingText = lineHeadingMatch[2];
      const fontSize = level === 1 ? 18 : level === 2 ? 16 : 15;
      paragraphChildren.push(
        <div key={`h-${lineIdx}`} style={{ fontWeight: 600, fontSize, color: 'var(--text-main)', margin: '6px 0 4px 0' }}>
          {parseInline(headingText, onPhotoClick, imageSize, highlightQuery, `h-${lineIdx}`, initData)}
        </div>
      );
      return;
    }

    const inlineNodes = parseInline(line, onPhotoClick, imageSize, highlightQuery, `ln-${lineIdx}`, initData);
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
  onClearSearch?: () => void,
  onJumpToBlock?: (paraIndex: number) => void,
  initData?: string
): { elements: React.ReactNode; matchCount: number } {
  if (!text) return { elements: null, matchCount: 0 };

  const query = highlightQuery?.trim() || '';
  const isFiltering = query.length >= 2;

  if (isFiltering) {
    const allBlocks = splitIntoBlocks(text);
    const paraIndexOf = buildParaIndexOfBlock(text);
    const matched = allBlocks
      .map((block, i) => ({ block, paraIndex: paraIndexOf[i] }))
      .filter(x => matchesSearch(x.block, query));

    if (matched.length === 0) {
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
          {matched.map((item, idx) => (
            <div
              key={`match-${query}-${idx}`}
              className={`filtered-record-card${onJumpToBlock ? ' filtered-record-card--clickable' : ''}`}
              style={{
                ['--record-index' as string]: idx,
              }}
              onClick={onJumpToBlock ? () => onJumpToBlock(item.paraIndex) : undefined}
              role={onJumpToBlock ? 'button' : undefined}
              tabIndex={onJumpToBlock ? 0 : undefined}
              onKeyDown={onJumpToBlock
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onJumpToBlock(item.paraIndex);
                    }
                  }
                : undefined}
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
                {onJumpToBlock && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    Перейти
                    <ChevronRight size={12} />
                  </span>
                )}
              </div>
              <div>{renderBlockContent(item.block, onPhotoClick, imageSize, query, initData)}</div>
            </div>
          ))}
        </div>
      ),
      matchCount: matched.length,
    };
  }

  // Default normal mode: render all raw blocks as standard markdown.
  // Каждый абзац помечен data-para-index — по нему поиск скроллит к нужному месту.
  const rawBlocks = text.split(/\n\s*\n/);
  const elements: React.ReactNode[] = [];
  let blockKey = 0;
  let paraIdx = -1;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    paraIdx++;

    elements.push(
      <div key={blockKey++} data-para-index={paraIdx} style={{ marginBottom: 12 }}>
        {renderBlockContent(block, onPhotoClick, imageSize, undefined, initData)}
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
  onJumpToBlock?: (paraIndex: number) => void;
}

function MarkdownText({
  content,
  imageSize = 'thumb',
  highlightQuery,
  onClearSearch,
  onMatchesCountChange,
  onJumpToBlock,
}: MarkdownTextProps) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const { authHeaders } = useAccessCheck();
  const initData = authHeaders?.['x-telegram-init-data'];

  const { elements, matchCount } = useMemo(
    () => renderMarkdown(content, setPhotoSrc, imageSize, highlightQuery, onClearSearch, onJumpToBlock, initData),
    [content, imageSize, highlightQuery, onClearSearch, onJumpToBlock, initData]
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
