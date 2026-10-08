import type { VizToolArgs } from '../types';

export function buildClientFallbackSvg(request: VizToolArgs): string {
  const items = (request.elements ?? []).slice(0, 6);
  const boxW = Math.min(160, Math.floor(560 / Math.max(items.length, 1)) - 12);
  const gap = 16;
  const totalW = items.length * boxW + Math.max(0, items.length - 1) * gap;
  const startX = (640 - totalW) / 2;

  const boxes = items
    .map((el, i) => {
      const x = startX + i * (boxW + gap);
      const y = 130;
      const detail = el.detail
        ? `<text x="${x + boxW / 2}" y="${y + 62}" text-anchor="middle" fill="#3D5A68" font-size="12" font-family="system-ui,sans-serif">${escapeXml(el.detail.slice(0, 28))}</text>`
        : '';
      const arrow =
        i < items.length - 1
          ? `<path d="M ${x + boxW + 2} ${y + 40} L ${x + boxW + gap - 2} ${y + 40}" stroke="#5BA4CF" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`
          : '';
      return `
        <rect x="${x}" y="${y}" width="${boxW}" height="80" rx="14" fill="#E8F2F0" stroke="#3D8B74" stroke-width="2"/>
        <text x="${x + boxW / 2}" y="${y + 42}" text-anchor="middle" fill="#1A3344" font-size="15" font-weight="600" font-family="system-ui,sans-serif">${escapeXml(el.label.slice(0, 18))}</text>
        ${detail}
        ${arrow}`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%">
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#5BA4CF"/>
      </marker>
    </defs>
    <rect width="640" height="360" rx="24" fill="#F5F8FA"/>
    <text x="320" y="48" text-anchor="middle" fill="#1A3344" font-size="22" font-weight="700" font-family="system-ui,sans-serif">${escapeXml(request.title)}</text>
    <text x="320" y="78" text-anchor="middle" fill="#3D5A68" font-size="14" font-family="system-ui,sans-serif">${escapeXml((request.caption || request.concept).slice(0, 90))}</text>
    ${boxes}
  </svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
