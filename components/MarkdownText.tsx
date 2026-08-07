'use client'

import React, { useState } from 'react';

function PhotoOverlay({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'page-enter 0.2s ease both',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Full photo" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
    </div>
  );
}

function renderMarkdown(text: string, onPhotoClick: (src: string) => void): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    // Image: ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      elements.push(
        <div key={key++} style={{ marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden', width: 120, height: 120 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgMatch[2]} alt={imgMatch[1]} onClick={() => onPhotoClick(imgMatch[2])} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
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
        parts.push(
          <span key={imgPartKey++} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '4px 0', borderRadius: 8, overflow: 'hidden', width: 100, height: 100 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgMatch[2]} alt={imgMatch[1]} onClick={() => onPhotoClick(imgMatch![2])} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
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

export default function MarkdownText({ content }: { content: string }) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  return (
    <>
      {renderMarkdown(content, setPhotoSrc)}
      {photoSrc && <PhotoOverlay src={photoSrc} onClose={() => setPhotoSrc(null)} />}
    </>
  );
}
