# LMSbox Interactive Component Design System

A reusable styling framework for HTML learning components in LMSbox. Extracted from the Loveable reference lessons in `interactive-lesson-componet-reference/`, then generalised so every future component inherits the same visual identity without local CSS.

Think of it as a learning-focused design system — similar in role to Material, Bootstrap, or Articulate Rise — scoped specifically to LMSbox interactive content.

## Interactive lesson blocks

The five fixed templates under `lmsbox.host/Templates/InteractiveBlocks/`
(accordion, text, carousel, questionnaire, video) no longer ship inline CSS.
They inherit from:

- `lmsbox-theme.css` — tokens and shared utilities
- `lmsbox-interactive-blocks.css` — block-specific layout for `.lmsbox-*` classes

The React iframe helper (`lmsbox.client/src/utils/interactiveBlockIframe.js`)
inlines both stylesheets into each block’s `srcDoc`, so preview and player
always match the design system.

Published copies also live in:

- `lmsBox.Server/wwwroot/`
- `lmsbox.client/public/`
- `lmsbox.client/src/styles/` (imported by the iframe builder)

When you change the theme, update `design-system/` then copy into those three locations.

---

## Quick start

```html
<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="lmsbox-theme.css">
</head>
<body class="lms-root">
  <div class="lms-container">
    <!-- components here -->
  </div>
  <script src="lmsbox-theme.js" defer></script>
</body>
</html>
```

Files:

| File | Purpose |
|------|---------|
| `lmsbox-theme.css` | Design tokens, utilities, component styles |
| `lmsbox-interactive-component-theme.css` | Same file (architecture alias) |
| `lmsbox-theme.js` | Progressive enhancement (toggles, quiz, flip, hotspot, process, reflection) |
| `examples/index.html` | Living showcase of every component |

**Rule:** No component should contain its own styling unless absolutely necessary. Change the theme; do not fork styles per page.

---

## Design tokens

All values live on `:root` as CSS custom properties. Nothing in components should hardcode colours.

### Brand

| Token | Value | Role |
|-------|-------|------|
| `--primary` | `#002e62` | Navy — text, strong surfaces |
| `--secondary` | `#0059a3` | Blue — labels, borders, links |
| `--accent` | `#ee7203` | Orange light — hover / secondary accent |
| `--accent-strong` | `#e74011` | Orange deep — CTAs, open states, warnings |

### Neutrals

| Token | Value |
|-------|-------|
| `--surface` | `#ffffff` |
| `--background` | `#f7f8fa` |
| `--text` | `#002e62` |
| `--text-secondary` | `#575756` |
| `--text-muted` | `#c4c2b2` |

### Spacing

```
--space-2xs  4px
--space-xs   8px
--space-sm   12px
--space-md   16px
--space-lg   24px
--space-xl   32px
--space-2xl  40px
--space-3xl  56px
--space-4xl  72px
```

### Radius

```
--radius-sm   10px
--radius-md   18px
--radius-lg   22px
--radius-xl   26px
--radius-pill 100px
```

### Shadows & motion

```
--shadow-sm / --shadow-md / --shadow-lg
--ease: cubic-bezier(0.22, 0.7, 0.28, 1)
```

### Typography

| Class | Use |
|-------|-----|
| `.lms-h1` / `.lms-heading` | Page title |
| `.lms-h2` / `.lms-subheading` | Section / reveal title |
| `.lms-h3` | Card / accordion title |
| `.lms-lead` | Intro under H1 |
| `.lms-body` | Body copy |
| `.lms-small` | Secondary body |
| `.lms-caption` | Footnotes / meta |
| `.lms-muted` | De-emphasised text |
| `.lms-highlight` | Emphasised phrase (navy medium) |
| `.lms-label` | Uppercase micro-label |
| `.lms-pullquote` | Key takeaway |

Font: **Poppins** (300–700), letter-spacing slightly tight (`-0.02em` body, `-0.025em` headings).

Compatible aliases (`--lmsbox-navy`, `--lmsbox-blue`, etc.) are provided for existing InteractiveBlocks templates.

---

## Utility classes

| Class | Role |
|-------|------|
| `.lms-container` | Max-width page shell (1080px) |
| `.lms-section` | Vertical section spacing |
| `.lms-pagehead` | Title + lead block |
| `.lms-card` | Information card |
| `.lms-card-hover` | Lift on hover |
| `.lms-panel` | Prose panel with left accent |
| `.lms-callout` | Accent callout (alias pattern of remember) |
| `.lms-grid` / `.lms-grid-2` / `.lms-grid-3` | Responsive grids |
| `.lms-stack` | Vertical flex stack |
| `.lms-row` | Horizontal flex row |
| `.lms-divider` | Hairline rule |
| `.lms-tag` | Solid navy pill tag |
| `.lms-pill` | Ghost pill (hero meta) |
| `.lms-chip` | Soft blue chip |
| `.lms-icon` | Icon well |
| `.lms-button` + `--primary` / `--ghost` / `--secondary` | Buttons |
| `.lms-animate-in` / `.lms-rise` | Scroll fade-rise |

Modifiers: `.lms-card--accent`, `.lms-card--warn`, `.lms-label--accent`, `.lms-stack--sm|lg|xl`.

---

## Standard components

Markup patterns below are the contract for the editor and for AI-generated HTML. Copy structure; fill content.

### Hero

```html
<section class="lms-hero">
  <img class="lms-hero__media" src="..." alt="">
  <div class="lms-hero__scrim" aria-hidden="true"></div>
  <div class="lms-hero__content">
    <div class="lms-hero__kicker">Module introduction</div>
    <h1 class="lms-hero__title">Heading</h1>
    <p class="lms-hero__intro">Introduction</p>
  </div>
</section>
```

Image is optional. Without media, use `.lms-hero--simple`.

### Information card

```html
<article class="lms-card lms-card-hover">
  <div class="lms-card__label">Label</div>
  <h3 class="lms-card__title">Title</h3>
  <p class="lms-card__body">Body</p>
</article>
```

### Click reveal

```html
<section class="lms-reveal" data-lms-toggle>
  <button class="lms-reveal__trigger" type="button" aria-expanded="false">
    <span class="lms-reveal__icon">…</span>
    <span style="flex:1">
      <span class="lms-reveal__label">Click to reveal</span>
      <h2 class="lms-reveal__title">Header</h2>
    </span>
    <span class="lms-plus" aria-hidden="true"></span>
  </button>
  <div class="lms-reveal__body">
    <div class="lms-reveal__inner">Hidden content</div>
  </div>
</section>
```

Add `.lms-reveal--warn` for cautionary reveals.

### Accordion

```html
<div class="lms-accordion">
  <div class="lms-accordion__item" data-lms-toggle data-exclusive=".lms-accordion__item">
    <button class="lms-accordion__trigger" type="button" aria-expanded="false">
      <h3 class="lms-accordion__title">Question</h3>
      <span class="lms-plus lms-plus--sm" aria-hidden="true"></span>
    </button>
    <div class="lms-accordion__body">
      <div class="lms-accordion__inner">Answer</div>
    </div>
  </div>
</div>
```

### Flip card

```html
<button class="lms-flip" type="button" data-lms-flip aria-label="…">
  <div class="lms-flip__inner">
    <div class="lms-flip__face lms-flip__front">…</div>
    <div class="lms-flip__face lms-flip__back">…</div>
  </div>
</button>
```

### Remember / Warning

```html
<aside class="lms-remember">
  <span class="lms-remember__icon">…</span>
  <div>
    <div class="lms-remember__label">Remember</div>
    <p>Message</p>
  </div>
</aside>

<aside class="lms-warning">
  <span class="lms-warning__icon">…</span>
  <div>
    <div class="lms-warning__label">Warning</div>
    <p>Message</p>
  </div>
</aside>
```

### Timeline

```html
<div class="lms-timeline">
  <div class="lms-timeline__item" data-lms-toggle data-exclusive=".lms-timeline__item">
    <button class="lms-timeline__trigger" type="button" aria-expanded="false">
      <span class="lms-timeline__num">1</span>
      <h3 class="lms-timeline__title">Stage</h3>
      <span class="lms-plus lms-plus--xs" aria-hidden="true"></span>
    </button>
    <div class="lms-timeline__body">
      <div class="lms-timeline__inner">Detail</div>
    </div>
  </div>
</div>
```

### Reflection

```html
<section class="lms-reflection" data-lms-reflect data-storage-key="unique-key">
  <div class="lms-reflection__label">Your reflection</div>
  <h2 class="lms-reflection__title">Prompt</h2>
  <p class="lms-reflection__prompt">Guidance</p>
  <label class="lms-sr" for="r1">Your reflection</label>
  <textarea id="r1" class="lms-reflection__input"></textarea>
  <div class="lms-reflection__footer">
    <span class="lms-reflection__count">0 words</span>
    <button type="button" class="lms-button lms-button--primary" data-lms-reflect-save>Save</button>
  </div>
</section>
```

### Multiple choice

```html
<section class="lms-question" data-lms-quiz>
  <div class="lms-question__head">…</div>
  <div class="lms-question__body">
    <p class="lms-question__prompt">Question?</p>
    <div class="lms-question__options">
      <button class="lms-question__option" type="button"
        data-correct="true"
        data-title="Feedback title"
        data-text="Feedback HTML">
        <span class="lms-question__key">A</span>
        <span>Option text</span>
      </button>
    </div>
    <div class="lms-question__feedback" role="status" aria-live="polite">
      <div class="lms-question__feedback-label">Feedback</div>
      <h3 data-fb-title></h3>
      <p data-fb-text></p>
    </div>
  </div>
</section>
```

### Hotspot

```html
<section class="lms-hotspot" data-lms-hotspot>
  <img class="lms-hotspot__image" src="…" alt="Diagram">
  <button class="lms-hotspot__pin" type="button" style="top:40%;left:30%" aria-controls="p1">1</button>
  <div id="p1" class="lms-hotspot__panel" hidden>
    <h3 class="lms-hotspot__panel-title">Title</h3>
    <p class="lms-hotspot__panel-body">Detail</p>
  </div>
</section>
```

### Process flow

```html
<section class="lms-process" data-lms-process>
  <div class="lms-process__stage">…nodes…</div>
  <div class="lms-process__steps">
    <div class="lms-process__step" data-step="1">…</div>
  </div>
  <div class="lms-process__controls">
    <button type="button" class="lms-button lms-button--primary" data-lms-process-next>Start</button>
    <button type="button" class="lms-button lms-button--ghost" data-lms-process-reset hidden>Replay</button>
    <span class="lms-process__progress">Step 0 of N</span>
  </div>
</section>
```

See `examples/index.html` for complete, copy-ready markup of every pattern.

---

## JavaScript API

`lmsbox-theme.js` auto-initialises on `DOMContentLoaded`.

| Attribute / class | Behaviour |
|-------------------|-----------|
| `data-lms-toggle` | Expand/collapse reveal, accordion, timeline |
| `data-exclusive="selector"` | Close siblings matching selector |
| `data-lms-quiz` | Single-select MCQ with feedback |
| `data-lms-flip` | 3D flip card |
| `data-lms-hotspot` | Pin → panel hotspots |
| `data-lms-process` | Stepwise process reveal |
| `data-lms-reflect` | Word count + optional `localStorage` |
| `.lms-animate-in` | IntersectionObserver fade-rise |

```js
window.LmsBoxTheme.init(optionalRoot);
window.LmsBoxTheme.wireToggle(el, { exclusive: '.item' });
window.LmsBoxTheme.buildQuiz(el);
```

---

## Responsive behaviour

Breakpoints are built into the theme:

- **≤900px** — grids collapse to one column; reveal / process / reflection padding tightens; hotspot panels go full-bleed width.
- **≤480px** — topbar stacks; process nodes shrink; primary buttons can go full-width.
- **320px–1920px** — fluid type via `clamp()`; container padding scales.

No per-component media queries should be needed.

---

## Animation language

Subtle, professional motion taken from the reference lessons:

| Motion | Where |
|--------|--------|
| Fade + rise (`translateY`) | `.lms-animate-in` on scroll |
| Card lift | `.lms-card-hover` |
| Accordion / reveal expand | `max-height` + plus rotation to × |
| Image drift / zoom | `.lms-hero__media` |
| Soft orb float | Hero decorative orbs |
| Option slide | Quiz option hover `translateX` |
| Pulse hint | `.lms-hint__pulse` |

`prefers-reduced-motion: reduce` disables animations and shows revealed content immediately.

---

## Accessibility

- Real `<button>` triggers with `aria-expanded` / `aria-pressed`
- `:focus-visible` ring using `--accent` (3px, offset 3px)
- Quiz feedback uses `role="status"` + `aria-live="polite"`
- Screen-reader utility: `.lms-sr`
- Colour contrast: navy/orange on paper and white surfaces meets WCAG AA for UI text at intended sizes
- Hotspots close on `Escape` and outside click

---

## Editor / future use

When the LMSbox editor lets instructional designers drag predefined components onto a page:

1. Each component template includes only semantic HTML + `lms-*` classes.
2. The page shell loads `lmsbox-theme.css` (and optionally `lmsbox-theme.js`) once.
3. Visual consistency is automatic — no designer-authored CSS.

Suggested template include:

```html
<link rel="stylesheet" href="/design-system/lmsbox-theme.css">
<script src="/design-system/lmsbox-theme.js" defer></script>
```

---

## Customising the brand

Override tokens on a host page or tenant wrapper — do not edit component HTML:

```css
:root {
  --primary: #0a2540;
  --secondary: #1a6fb5;
  --accent: #f08a24;
  --accent-strong: #d94e12;
}
```

All components follow.

---

## Reference source

Visual decisions were extracted from:

`lmsBox/interactive-lesson-componet-reference/`

(pages 01–10: hero, reveal, compare, process, quiz, timeline, accordion, reflection). Brand-specific chrome (BIFA logo lockup) is intentionally **not** part of the shared system — components stay LMSbox-generic.
