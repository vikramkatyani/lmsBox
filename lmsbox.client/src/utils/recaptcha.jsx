import ReCAPTCHA from 'react-google-recaptcha';
import { createRef } from 'react';

const recaptchaRef = createRef();
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() || '';

export const executeRecaptcha = async () => {
  if (!siteKey) {
    // Backend skips verification when Recaptcha:SecretKey is not configured.
    return 'dev-skip';
  }
  try {
    const token = await recaptchaRef.current?.executeAsync();
    return token;
  } catch (error) {
    console.error('reCAPTCHA execution failed:', error);
    return null;
  }
};

export const RecaptchaComponent = () => {
  if (!siteKey) return null;
  return (
    <ReCAPTCHA
      ref={recaptchaRef}
      size="invisible"
      sitekey={siteKey}
    />
  );
};

export { recaptchaRef };