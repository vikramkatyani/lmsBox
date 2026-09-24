/**
 * Maps the active tenant brand onto the interactive-lesson design tokens.
 * Later, per-component colour and border settings can replace this mapping.
 */

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value) {
  const raw = String(value || '').trim();
  if (!HEX.test(raw)) return null;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
}

function parseHex(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }) {
  const channel = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mix(a, b, amount) {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

function luminance(color) {
  const lin = (channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(color.r) + 0.7152 * lin(color.g) + 0.0722 * lin(color.b);
}

function contrastText(hex) {
  const color = parseHex(hex);
  if (!color) return '#ffffff';
  return luminance(color) > 0.45 ? '#1b2430' : '#ffffff';
}

function lighten(hex, amount) {
  const color = parseHex(hex);
  if (!color) return hex;
  return toHex(mix(color, { r: 255, g: 255, b: 255 }, amount));
}

function darken(hex, amount) {
  const color = parseHex(hex);
  if (!color) return hex;
  return toHex(mix(color, { r: 0, g: 0, b: 0 }, amount));
}

function readableText(hex) {
  const color = parseHex(hex);
  if (!color) return '#1b2430';
  if (luminance(color) <= 0.35) return normalizeHex(hex);
  return darken(hex, 0.55);
}

function safeFontFamily(value) {
  const raw = String(value || '').trim();
  if (!raw || /[{};<>]/.test(raw)) return '';
  return raw.slice(0, 120);
}

function resolvePalette(theme = {}) {
  const primary = normalizeHex(theme.primaryColor) || '#1b365d';
  const button = normalizeHex(theme.buttonColor) || normalizeHex(theme.accentColor) || '#2afeae';
  const accent = normalizeHex(theme.accentColor) || lighten(button, 0.12);
  const accentStrong = normalizeHex(theme.accentStrongColor) || button;
  const secondary = normalizeHex(theme.secondaryColor)
    || (luminance(parseHex(primary)) > 0.45 ? darken(primary, 0.22) : lighten(primary, 0.28));
  const background = normalizeHex(theme.pageBackgroundColor) || '#f5f5ef';
  const buttonText = normalizeHex(theme.buttonTextColor) || contrastText(accentStrong);

  return {
    primary,
    secondary,
    accent,
    accentStrong,
    background,
    text: readableText(primary),
    textOnPrimary: contrastText(primary),
    textOnAccent: buttonText,
    fontFamily: safeFontFamily(theme.fontFamily),
  };
}

export function interactiveLessonFontHref(theme) {
  const family = String(theme?.fontFamily || '').toLowerCase();
  const families = ['Poppins:wght@300;400;500;600;700'];
  if (family.includes('inter')) {
    families.push('Inter:wght@400;500;600;700');
  }
  return `https://fonts.googleapis.com/css2?${families.map((item) => `family=${item}`).join('&')}&display=swap`;
}

/** CSS custom properties that restyle interactive blocks to the tenant brand. */
export function buildInteractiveLessonThemeCss(theme) {
  const palette = resolvePalette(theme);
  const font = palette.fontFamily
    ? `--font-family:${palette.fontFamily};`
    : '';

  return `:root{
--primary:${palette.primary};
--secondary:${palette.secondary};
--accent:${palette.accent};
--accent-strong:${palette.accentStrong};
--background:${palette.background};
--text:${palette.text};
--text-on-primary:${palette.textOnPrimary};
--text-on-accent:${palette.textOnAccent};
--primary-08:color-mix(in srgb,var(--primary) 8%,transparent);
--primary-16:color-mix(in srgb,var(--primary) 16%,transparent);
--primary-04:color-mix(in srgb,var(--primary) 4%,transparent);
--secondary-05:color-mix(in srgb,var(--secondary) 5%,transparent);
--secondary-09:color-mix(in srgb,var(--secondary) 9%,transparent);
--secondary-10:color-mix(in srgb,var(--secondary) 10%,transparent);
--secondary-035:color-mix(in srgb,var(--secondary) 3.5%,transparent);
--accent-03:color-mix(in srgb,var(--accent) 3%,transparent);
--accent-10:color-mix(in srgb,var(--accent) 10%,transparent);
--accent-30:color-mix(in srgb,var(--accent) 30%,transparent);
--accent-strong-08:color-mix(in srgb,var(--accent-strong) 8%,transparent);
--accent-strong-12:color-mix(in srgb,var(--accent-strong) 12%,transparent);
--accent-strong-13:color-mix(in srgb,var(--accent-strong) 13%,transparent);
--accent-strong-14:color-mix(in srgb,var(--accent-strong) 14%,transparent);
--accent-strong-50:color-mix(in srgb,var(--accent-strong) 50%,transparent);
--accent-strong-shadow:color-mix(in srgb,var(--accent-strong) 90%,transparent);
--scrim-strong:color-mix(in srgb,var(--primary) 94%,transparent);
--scrim-mid:color-mix(in srgb,var(--primary) 80%,transparent);
--scrim-soft:color-mix(in srgb,var(--primary) 10%,transparent);
--hero-kicker:color-mix(in srgb,var(--accent) 35%,white);
--border:var(--primary-08);
--border-strong:var(--primary-16);
--focus-ring:3px solid var(--accent);
--lmsbox-navy:var(--primary);
--lmsbox-blue:var(--secondary);
--lmsbox-orange:var(--accent-strong);
--lmsbox-orange-l:var(--accent);
--lmsbox-paper:var(--background);
--lmsbox-primary:var(--primary);
--lmsbox-focus:var(--accent);
--lmsbox-text:var(--text);
--lmsbox-border:var(--border);
${font}
}`;
}
