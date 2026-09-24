const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function safeHexColor(value) {
  const color = String(value || '').trim();
  return HEX.test(color) ? color : '';
}

export function publishBrandingUpdate(detail) {
  window.dispatchEvent(new CustomEvent('lmsbox-branding-updated', { detail }));
}

export function applyNavChromeColors(theme = {}) {
  const bar = safeHexColor(theme.navBarColor);
  const menu = safeHexColor(theme.navMenuColor);
  const active = safeHexColor(theme.navMenuActiveColor);
  const styleId = 'tenant-nav-colors';
  let styleEl = document.getElementById(styleId);

  if (!bar && !menu && !active) {
    styleEl?.remove();
    return;
  }

  const vars = [];
  if (bar) vars.push(`--color-boxlms-navbar: ${bar};`, `--color-app-nav-bg: ${bar};`);
  if (menu) vars.push(`--color-boxlms-navbar-txt: ${menu};`, `--color-app-nav-text: ${menu};`);
  if (active) vars.push(`--color-boxlms-navbar-active: ${active};`, `--color-app-nav-active: ${active};`);

  const rules = [
    `html header.learner-header, html header.admin-header { ${vars.join(' ')} }`
  ];

  if (bar) {
    rules.push(
      `html header.learner-header, html header.admin-header { background-color: ${bar} !important; }`,
      `@media (max-width: 1023px) { html header.admin-header .admin-nav-menu { background-color: ${bar} !important; } }`
    );
  }

  if (menu) {
    rules.push(
      `html header.learner-header .text-boxlms-navbar-txt, html header.admin-header .text-boxlms-navbar-txt { color: ${menu} !important; }`,
      `html header.learner-header button.relative svg, html header.admin-header button.relative svg, html header.admin-header .fill-boxlms-navbar-txt { fill: ${menu} !important; }`
    );
  }

  if (active) {
    rules.push(
      `html header.learner-header .text-boxlms-navbar-active, html header.admin-header .text-boxlms-navbar-active, html header.learner-header .hover\\:text-boxlms-navbar-active:hover, html header.admin-header .hover\\:text-boxlms-navbar-active:hover { color: ${active} !important; }`,
      `html header.learner-header .bg-boxlms-navbar-active, html header.admin-header .bg-boxlms-navbar-active, html header.learner-header .lg\\:after\\:bg-boxlms-navbar-active::after, html header.admin-header .lg\\:after\\:bg-boxlms-navbar-active::after { background-color: ${active} !important; }`
    );
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = rules.join('\n');
}
