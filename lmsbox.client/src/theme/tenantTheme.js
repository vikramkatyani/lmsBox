export const DEFAULT_TENANT_THEME = {
  brandName: '',
  bannerUrl: '',
  faviconUrl: '',
  loginHeroUrl: '',
  primaryColor: '#1b365d',
  pageBackgroundColor: '#F5F5EF',
  buttonColor: '#2afeae',
  buttonTextColor: '#1b365d',
  accentColor: '#2afeae',
  fontFamily: '',
  customCss: ''
};

export const TENANT_FONT_OPTIONS = [
  { label: 'Default (LMS Box)', value: '' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Poppins', value: 'Poppins, Arial, Helvetica, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' }
];

export function brandingToForm(data = {}) {
  return {
    brandName: data.brandName || '',
    bannerUrl: data.bannerUrl || data.logoUrl || '',
    faviconUrl: data.faviconUrl || '',
    loginHeroUrl: data.loginHeroUrl || '',
    primaryColor: data.primaryColor || DEFAULT_TENANT_THEME.primaryColor,
    pageBackgroundColor: data.pageBackgroundColor || DEFAULT_TENANT_THEME.pageBackgroundColor,
    buttonColor: data.buttonColor || data.accentColor || DEFAULT_TENANT_THEME.buttonColor,
    buttonTextColor: data.buttonTextColor || DEFAULT_TENANT_THEME.buttonTextColor,
    accentColor: data.accentColor || DEFAULT_TENANT_THEME.accentColor,
    fontFamily: data.fontFamily || '',
    customCss: data.customCss || ''
  };
}

export function formToBrandingPayload(form) {
  return {
    brandName: form.brandName || null,
    bannerUrl: form.bannerUrl || null,
    faviconUrl: form.faviconUrl || null,
    loginHeroUrl: form.loginHeroUrl || null,
    primaryColor: form.primaryColor || null,
    pageBackgroundColor: form.pageBackgroundColor || null,
    buttonColor: form.buttonColor || null,
    buttonTextColor: form.buttonTextColor || null,
    accentColor: form.accentColor || null,
    fontFamily: form.fontFamily || null,
    customCss: form.customCss || null
  };
}
