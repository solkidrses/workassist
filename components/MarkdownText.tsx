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
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function parseInline(
  text: string,
  onPhotoClick: (src: string) => void,
  imageSize: 'thumb' | 'full',
  highlightQuery?: string
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
        <React.Fragment key={key++}>
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
          key={key++}
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
        <strong key={key++} style={{ fontWeight: 600, color: 'var(--text-main)' }}>
          {highlightQuery ? highlightText(boldContent, highlightQuery) : boldContent}
        </strong>
      );
    } else if (match[6]) {
      // Code snippet
      const codeContent = match[7];
      nodes.push(
        <code
          key={key++}
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
      <React.Fragment key={key++}>
        {highlightQuery ? highlightText(plain, highlightQuery) : plain}
      </React.Fragment>
    );
  }

  return nodes;
}

function renderMarkdown(
  text: string,
  onPhotoClick: (src: string) => void,
  imageSize: 'thumb' | 'full',
  highlightQuery?: string
): React.ReactNode[] {
  if (!text) return [];

  const rawBlocks = text.split(/\n\s*\n/);
  const elements: React.ReactNode[] = [];
  let blockKey = 0;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

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

      elements.push(
        <div key={blockKey++} style={wrapperStyle}>
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
      continue;
    }

    // Paragraph block
    const lines = trimmed.split('\n');
    const paragraphChildren: React.ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        paragraphChildren.push(<br key={`br-${lineIdx}`} />);
      }
      const inlineNodes = parseInline(line, onPhotoClick, imageSize, highlightQuery);
      paragraphChildren.push(...inlineNodes);
    });

    elements.push(
      <p
        key={blockKey++}
        style={{
          margin: '0 0 12px 0',
          lineHeight: 1.65,
          wordBreak: 'break-word',
        }}
      >
        {paragraphChildren}
      </p>
    );
  }

  return elements;
}

function MarkdownText({
  content,
  imageSize = 'thumb',
  highlightQuery
}: {
  content: string;
  imageSize?: 'thumb' | 'full';
  highlightQuery?: string;
}) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const rendered = useMemo(
    () => renderMarkdown(content, setPhotoSrc, imageSize, highlightQuery),
    [content, imageSize, highlightQuery]
  );

  return (
    <>
      {rendered}
      {photoSrc && <PhotoOverlay src={photoSrc} onClose={() => setPhotoSrc(null)} />}
    </>
  );
}

export default memo(MarkdownText);
