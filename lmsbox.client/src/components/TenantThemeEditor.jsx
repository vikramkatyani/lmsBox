import { useRef, useState } from 'react';
import { CloudArrowUpIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import loginIllustration from '../assets/login-image.png';
import lmsLogo from '../assets/lmsbox-logo.png';
import { DEFAULT_TENANT_THEME, TENANT_FONT_OPTIONS } from '../theme/tenantTheme';

function ColorField({ label, value, fallback, onChange }) {
  const hex = value || fallback;
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 border border-gray-300 rounded cursor-pointer"
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
        />
      </div>
    </label>
  );
}

function ImageUploadCard({ label, hint, value, fallbackSrc, accept, uploading, onUpload, onClear, previewClass }) {
  const inputRef = useRef(null);
  const preview = value || fallbackSrc;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
        {value && (
          <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:text-red-600">
            Remove
          </button>
        )}
      </div>
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-md p-3 flex items-center justify-center min-h-[88px] mb-3">
        {preview ? (
          <img src={preview} alt={label} className={previewClass || 'max-h-16 w-auto object-contain'} />
        ) : (
          <span className="text-xs text-gray-400">No image</span>
        )}
      </div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60"
      >
        <CloudArrowUpIcon className="h-4 w-4 mr-2" />
        {uploading ? 'Uploading...' : 'Upload image'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,.ico'}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}

export default function TenantThemeEditor({
  form,
  onChange,
  onUpload,
  uploading = {},
  loginPath,
  tenantName,
  saving,
  onSave
}) {
  const [showCss, setShowCss] = useState(!!form.customCss);
  const cssFileRef = useRef(null);
  const setField = (key, value) => onChange({ ...form, [key]: value });

  const preview = {
    brandName: form.brandName || tenantName || 'LMS Box',
    logo: form.bannerUrl || lmsLogo,
    pageBg: form.pageBackgroundColor || DEFAULT_TENANT_THEME.pageBackgroundColor,
    boxBg: form.primaryColor || DEFAULT_TENANT_THEME.primaryColor,
    buttonBg: form.buttonColor || DEFAULT_TENANT_THEME.buttonColor,
    buttonText: form.buttonTextColor || DEFAULT_TENANT_THEME.buttonTextColor,
    hero: form.loginHeroUrl || loginIllustration,
    font: form.fontFamily || 'Inter, system-ui, sans-serif'
  };

  const handleCssFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setField('customCss', String(reader.result || ''));
      setShowCss(true);
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <form onSubmit={onSave} className="space-y-6">
        <section className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Brand</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
            <input
              value={form.brandName}
              onChange={(e) => setField('brandName', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder={tenantName || 'LMS Box'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Font</label>
            <select
              value={form.fontFamily}
              onChange={(e) => setField('fontFamily', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {TENANT_FONT_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Images</h2>
          <p className="text-sm text-gray-600">Upload files rather than pasting URLs. PNG, SVG, JPG or WebP, up to 10 MB.</p>
          <ImageUploadCard
            label="Logo"
            hint="Shown on the login page and in the header"
            value={form.bannerUrl}
            fallbackSrc={lmsLogo}
            uploading={uploading.logo}
            onUpload={(file) => onUpload('logo', file)}
            onClear={() => setField('bannerUrl', '')}
          />
          <ImageUploadCard
            label="Favicon"
            hint="Browser tab icon"
            value={form.faviconUrl}
            fallbackSrc={form.bannerUrl || lmsLogo}
            uploading={uploading.favicon}
            onUpload={(file) => onUpload('favicon', file)}
            onClear={() => setField('faviconUrl', '')}
            previewClass="h-10 w-10 object-contain"
          />
          <ImageUploadCard
            label="Login page image"
            hint="Illustration on the right of the login page"
            value={form.loginHeroUrl}
            fallbackSrc={loginIllustration}
            uploading={uploading.loginhero}
            onUpload={(file) => onUpload('loginhero', file)}
            onClear={() => setField('loginHeroUrl', '')}
            previewClass="max-h-28 w-auto object-contain"
          />
        </section>

        <section className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Colours</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label="Primary / login card"
              value={form.primaryColor}
              fallback={DEFAULT_TENANT_THEME.primaryColor}
              onChange={(value) => setField('primaryColor', value)}
            />
            <ColorField
              label="Page background"
              value={form.pageBackgroundColor}
              fallback={DEFAULT_TENANT_THEME.pageBackgroundColor}
              onChange={(value) => setField('pageBackgroundColor', value)}
            />
            <ColorField
              label="Button"
              value={form.buttonColor}
              fallback={DEFAULT_TENANT_THEME.buttonColor}
              onChange={(value) => setField('buttonColor', value)}
            />
            <ColorField
              label="Button text"
              value={form.buttonTextColor}
              fallback={DEFAULT_TENANT_THEME.buttonTextColor}
              onChange={(value) => setField('buttonTextColor', value)}
            />
            <ColorField
              label="Accent"
              value={form.accentColor}
              fallback={DEFAULT_TENANT_THEME.accentColor}
              onChange={(value) => setField('accentColor', value)}
            />
          </div>
        </section>

        <section className="bg-white shadow rounded-lg p-6">
          <button
            type="button"
            onClick={() => setShowCss((open) => !open)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Advanced: custom CSS</h2>
              <p className="text-sm text-gray-500">Optional. Most tenants only need the fields above.</p>
            </div>
            {showCss ? <ChevronUpIcon className="h-5 w-5 text-gray-500" /> : <ChevronDownIcon className="h-5 w-5 text-gray-500" />}
          </button>
          {showCss && (
            <div className="mt-4 space-y-3">
              <textarea
                value={form.customCss}
                onChange={(e) => setField('customCss', e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
                placeholder={`.login-logo-frame { border-radius: 12px; }`}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => cssFileRef.current?.click()}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  Load from .css file
                </button>
                <input
                  ref={cssFileRef}
                  type="file"
                  accept=".css,text/css"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleCssFile(file);
                  }}
                />
                <p className="text-xs text-gray-500">The file is stored as text on the tenant, not as a separate stylesheet.</p>
              </div>
            </div>
          )}
        </section>

        <div className="flex items-center justify-end gap-3">
          {loginPath && (
            <a
              href={loginPath}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700"
            >
              Open live login
            </a>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#1b365d' }}
          >
            {saving ? 'Saving...' : 'Save theme'}
          </button>
        </div>
      </form>

      <div className="xl:sticky xl:top-6 h-fit">
        <p className="text-sm font-medium text-gray-700 mb-3">Login preview</p>
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ backgroundColor: preview.pageBg, fontFamily: preview.font }}>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center min-h-[320px]">
            <div className="rounded-lg p-5 shadow" style={{ backgroundColor: preview.boxBg }}>
              <div className="flex justify-center mb-3">
                <img src={preview.logo} alt="" className="h-10 w-auto object-contain" />
              </div>
              <p className="text-center text-white text-lg font-semibold">Sign in</p>
              <p className="text-center text-white/80 text-xs mt-1 mb-4">{preview.brandName}</p>
              <div className="h-8 rounded bg-white/90 mb-3" />
              <button
                type="button"
                className="w-full py-2 rounded text-sm font-medium"
                style={{ backgroundColor: preview.buttonBg, color: preview.buttonText }}
              >
                Send Login link
              </button>
            </div>
            <div className="hidden sm:flex items-center justify-center">
              <img src={preview.hero} alt="" className="max-h-40 w-auto object-contain" />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">This updates as you change the form. Save to apply it to the real login page.</p>
      </div>
    </div>
  );
}
