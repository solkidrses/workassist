export function cleanupText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\[([^\]]*)\]\(#[^)]*\)/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n{2,}(?=[#*\-])/g, '\n')
    .trim();
}

export function deriveTitle(text: string, fallback: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const first = lines[0]
      .replace(/^#+\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .trim();
    if (first.length > 0 && first.length <= 120) return first;
    if (first.length > 120) return first.slice(0, 80).trim() + '...';
  }
  return fallback;
}

export function deriveSummary(text: string): string {
  const plain = text
    .replace(/[#*`>_~]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= 150) return plain;
  const cut = plain.slice(0, 150);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + '...';
}
