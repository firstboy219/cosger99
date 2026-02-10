
// Theme Presets Configuration

export interface ThemeConfig {
  id: string;
  name: string;
  primaryColor: string; // Brand Color
  secondaryColor: string; // Accents
  bgColor: string; // Background
  textColor: string;
  inputBg: string;
  fontFamily: string;
  borderRadius: string;
  description: string;
}

export const themePresets: ThemeConfig[] = [
  {
    id: 'trust',
    name: 'Trust (Default)',
    primaryColor: '#2563eb', // Blue 600
    secondaryColor: '#1e40af',
    bgColor: '#f4f4f5',
    textColor: '#0f172a',
    inputBg: '#ffffff',
    fontFamily: 'Inter',
    borderRadius: '0.75rem', // 12px
    description: 'Profesional, bersih, dan terpercaya. Cocok untuk fintech standar.'
  },
  {
    id: 'calm',
    name: 'Tenang (Calm)',
    primaryColor: '#475569', // Slate 600
    secondaryColor: '#94a3b8',
    bgColor: '#f0fdf4', // Light Green hint
    textColor: '#334155',
    inputBg: '#ffffff',
    fontFamily: 'Poppins',
    borderRadius: '1rem', // 16px (Softer)
    description: 'Warna alam yang menenangkan. Mengurangi stres saat melihat hutang.'
  },
  {
    id: 'happy',
    name: 'Happy (Fun)',
    primaryColor: '#f59e0b', // Amber 500
    secondaryColor: '#8b5cf6', // Purple
    bgColor: '#fffbeb', // Yellow hint
    textColor: '#1f2937',
    inputBg: '#ffffff',
    fontFamily: 'Comic Neue, sans-serif', // Fallback if not loaded, mostly Poppins/Inter
    borderRadius: '1.5rem', // Very round
    description: 'Penuh energi dan semangat. Membuat bayar cicilan jadi lebih asyik.'
  },
  {
    id: 'corporate',
    name: 'Corporate',
    primaryColor: '#0f172a', // Slate 900
    secondaryColor: '#334155',
    bgColor: '#e2e8f0', // Grey
    textColor: '#020617',
    inputBg: '#f8fafc',
    fontFamily: 'Roboto',
    borderRadius: '0.25rem', // 4px (Sharp)
    description: 'Tegas, serius, dan tanpa basa-basi.'
  },
  {
    id: 'luxury',
    name: 'Mewah (Sultan)',
    primaryColor: '#d97706', // Gold/Amber 600
    secondaryColor: '#000000',
    bgColor: '#1c1917', // Dark Stone
    textColor: '#fafaf9', // Light Stone
    inputBg: '#292524',
    fontFamily: 'Serif',
    borderRadius: '0.5rem',
    description: 'Tema gelap eksklusif dengan aksen emas.'
  }
];

export const applyTheme = (presetId: string) => {
  const theme = themePresets.find(t => t.id === presetId) || themePresets[0];
  const root = document.documentElement;

  root.style.setProperty('--color-brand-600', theme.primaryColor);
  // We simulate Tailwind colors by just setting base variables that we might use in custom CSS
  // Note: Tailwind classes are pre-compiled, so we rely on style overrides for dynamic values
  
  // Update Body
  document.body.style.backgroundColor = theme.bgColor;
  document.body.style.color = theme.textColor;
  document.body.style.fontFamily = `${theme.fontFamily}, sans-serif`;

  // Update Global Inputs
  root.style.setProperty('--input-bg', theme.inputBg);
  root.style.setProperty('--input-text', theme.textColor);
  
  return theme;
};
