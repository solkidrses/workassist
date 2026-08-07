'use client'

import React from 'react';

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    // Image: ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      elements.push(
        <div key={key++} style={{ marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgMatch[2]} alt={imgMatch[1]} style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }} />
        </div>
      );
      continue;
    }

    // Inline image within text
    const inlineImgPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    if (inlineImgPattern.test(line)) {
      inlineImgPattern.lastIndex = 0;
      const parts: React.ReactNode[] = [];
      let lastIdx = 0;
      let match;
      let partKey = 0;
      while ((match = inlineImgPattern.exec(line)) !== null) {
        if (match.index > lastIdx) {
          parts.push(<React.Fragment key={partKey++}>{line.slice(lastIdx, match.index)}</React.Fragment>);
        }
        parts.push(
          <span key={partKey++} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '4px 0', borderRadius: 8, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={match[2]} alt={match[1]} style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }} />
          </span>
        );
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < line.length) {
        parts.push(<React.Fragment key={partKey++}>{line.slice(lastIdx)}</React.Fragment>);
      }
      elements.push(<div key={key++}>{parts}</div>);
      continue;
    }

    // Bold **text**
    const boldParts: React.ReactNode[] = [];
    const boldPattern = /\*\*([^*]+)\*\*/g;
    let lastIdx = 0;
    let match;
    let partKey = 0;
    while ((match = boldPattern.exec(line)) !== null) {
      if (match.index > lastIdx) {
        boldParts.push(<React.Fragment key={partKey++}>{line.slice(lastIdx, match.index)}</React.Fragment>);
      }
      boldParts.push(<strong key={partKey++}>{match[1]}</strong>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) {
      boldParts.push(<React.Fragment key={partKey++}>{line.slice(lastIdx)}</React.Fragment>);
    }
    if (boldParts.length > 0) {
      elements.push(<div key={key++}>{boldParts}</div>);
      continue;
    }

    // Code block `code`
    const codeParts: React.ReactNode[] = [];
    const codePattern = /`([^`]+)`/g;
    lastIdx = 0;
    partKey = 0;
    let hasCode = false;
    while ((match = codePattern.exec(line)) !== null) {
      if (match.index > lastIdx) {
        codeParts.push(<React.Fragment key={partKey++}>{line.slice(lastIdx, match.index)}</React.Fragment>);
      }
      codeParts.push(
        <code key={partKey++} style={{ backgroundColor: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}>
          {match[1]}
        </code>
      );
      lastIdx = match.index + match[0].length;
      hasCode = true;
    }
    if (hasCode) {
      if (lastIdx < line.length) {
        codeParts.push(<React.Fragment key={partKey++}>{line.slice(lastIdx)}</React.Fragment>);
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
  return <>{renderMarkdown(content)}</>;
}
