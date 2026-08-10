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

function renderMarkdown(text: string, onPhotoClick: (src: string) => void, imageSize: 'thumb' | 'full'): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    // Image: ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const imgStyle: React.CSSProperties = imageSize === 'full'
        ? { width: '100%', height: 'auto', borderRadius: 10, cursor: 'pointer', display: 'block' }
        : { width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' };
      const wrapperStyle = imageSize === 'full'
        ? { marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden' }
        : { marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden', width: 120, height: 120 };
      elements.push(
        <div key={key++} style={wrapperStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgMatch[2]} alt={imgMatch[1]} loading="lazy" decoding="async" onClick={() => onPhotoClick(imgMatch[2])} style={imgStyle} />
        </div>
      );
      continue;
    }

    // Inline image within text
    const inlineImgPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    if (inlineImgPattern.test(line)) {
      inlineImgPattern.lastIndex = 0;
      const parts: React.ReactNode[] = [];
      let imgLastIdx = 0;
      let imgPartKey = 0;
      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = inlineImgPattern.exec(line)) !== null) {
        if (!imgMatch) continue;
        if (imgMatch.index > imgLastIdx) {
          parts.push(<React.Fragment key={imgPartKey++}>{line.slice(imgLastIdx, imgMatch.index)}</React.Fragment>);
        }
        const imgSrc = imgMatch[2];
        const imgAlt = imgMatch[1];
        parts.push(
          <span key={imgPartKey++} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '4px 0', borderRadius: 8, overflow: 'hidden', width: imageSize === 'full' ? '100%' : 100, height: imageSize === 'full' ? 'auto' : 100 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={imgAlt} loading="lazy" decoding="async" onClick={() => onPhotoClick(imgSrc)} style={{ width: '100%', height: imageSize === 'full' ? 'auto' : '100%', objectFit: imageSize === 'full' ? 'contain' : 'cover', cursor: 'pointer' }} />
          </span>
        );
        imgLastIdx = imgMatch.index + imgMatch[0].length;
      }
      if (imgLastIdx < line.length) {
        parts.push(<React.Fragment key={imgPartKey++}>{line.slice(imgLastIdx)}</React.Fragment>);
      }
      elements.push(<div key={key++}>{parts}</div>);
      continue;
    }

    // Bold **text**
    const boldParts: React.ReactNode[] = [];
    const boldPattern = /\*\*([^*]+)\*\*/g;
    let boldLastIdx = 0;
    let boldPartKey = 0;
    let boldMatch: RegExpExecArray | null;
    while ((boldMatch = boldPattern.exec(line)) !== null) {
      if (!boldMatch) continue;
      if (boldMatch.index > boldLastIdx) {
        boldParts.push(<React.Fragment key={boldPartKey++}>{line.slice(boldLastIdx, boldMatch.index)}</React.Fragment>);
      }
      boldParts.push(<strong key={boldPartKey++}>{boldMatch[1]}</strong>);
      boldLastIdx = boldMatch.index + boldMatch[0].length;
    }
    if (boldLastIdx < line.length) {
      boldParts.push(<React.Fragment key={boldPartKey++}>{line.slice(boldLastIdx)}</React.Fragment>);
    }
    if (boldParts.length > 0) {
      elements.push(<div key={key++}>{boldParts}</div>);
      continue;
    }

    // Code block `code`
    const codeParts: React.ReactNode[] = [];
    const codePattern = /`([^`]+)`/g;
    let codeLastIdx = 0;
    let codePartKey = 0;
    let codeMatch: RegExpExecArray | null;
    let hasCode = false;
    while ((codeMatch = codePattern.exec(line)) !== null) {
      if (!codeMatch) continue;
      if (codeMatch.index > codeLastIdx) {
        codeParts.push(<React.Fragment key={codePartKey++}>{line.slice(codeLastIdx, codeMatch.index)}</React.Fragment>);
      }
      codeParts.push(
        <code key={codePartKey++} style={{ backgroundColor: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}>
          {codeMatch[1]}
        </code>
      );
      codeLastIdx = codeMatch.index + codeMatch[0].length;
      hasCode = true;
    }
    if (hasCode) {
      if (codeLastIdx < line.length) {
        codeParts.push(<React.Fragment key={codePartKey++}>{line.slice(codeLastIdx)}</React.Fragment>);
      }
      elements.push(<div key={key++}>{codeParts}</div>);
      continue;
    }

    // Regular line
    if (line.trim()) {
      elements.push(<div key={key++}>{line}</div>);
    } else {
      elements.push(<div key={key++} style={{ height: 8 }} />);
    }
  }

  return elements;
}

function MarkdownText({ content, imageSize = 'thumb' }: { content: string; imageSize?: 'thumb' | 'full' }) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const rendered = useMemo(() => renderMarkdown(content, setPhotoSrc, imageSize), [content, imageSize]);
  return (
    <>
      {rendered}
      {photoSrc && <PhotoOverlay src={photoSrc} onClose={() => setPhotoSrc(null)} />}
    </>
  );
}

export default memo(MarkdownText);
