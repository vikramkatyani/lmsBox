import catalog from '../data/lucideIconCatalog.json';

const LUCIDE_PREFIX = 'lucide:';
const SOLID_SUFFIX = ':solid';

export const LUCIDE_ICON_NAMES = Object.keys(catalog).sort();

export function parseIconKey(value) {
  const raw = (value || '').trim();
  const match = raw.match(/^lucide:([a-z0-9]+(?:-[a-z0-9]+)*)(?::solid)?$/);
  if (!match || !catalog[match[1]]) {
    return { name: '', style: 'outline' };
  }
  return {
    name: match[1],
    style: raw.endsWith(SOLID_SUFFIX) ? 'solid' : 'outline',
  };
}

export function formatIconKey(name, style = 'outline') {
  if (!name || !catalog[name]) return '';
  return style === 'solid' ? `${LUCIDE_PREFIX}${name}${SOLID_SUFFIX}` : `${LUCIDE_PREFIX}${name}`;
}

export function humanizeIconName(name) {
  if (!name) return 'Default';
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function renderLucideIconSvg(name, style = 'outline') {
  const inner = catalog[name];
  if (!inner) return '';
  const isSolid = style === 'solid';
  return `<svg viewBox="0 0 24 24" fill="${isSolid ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${isSolid ? '1.5' : '2'}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function searchLucideIcons(query) {
  const normalised = (query || '').trim().toLowerCase();
  if (!normalised) return LUCIDE_ICON_NAMES;
  const compact = normalised.replaceAll(/\s+/g, '-');
  return LUCIDE_ICON_NAMES.filter((name) => {
    if (name.includes(compact)) return true;
    return humanizeIconName(name).toLowerCase().includes(normalised);
  });
}
