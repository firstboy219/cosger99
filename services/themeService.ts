// ============================================================================
// COSGER THEME ENGINE v2.0
// CSS Variable-based dynamic theming for all pages (dashboard, admin, landing)
// ============================================================================

export type ButtonShape     = 'square' | 'rounded' | 'pill';
export type ShadowIntensity = 'none' | 'soft' | 'medium' | 'strong';
export type SidebarStyle    = 'dark' | 'light' | 'brand' | 'glass';
export type AnimSpeed       = 'off' | 'fast' | 'normal' | 'slow';
export type FontWeight      = '400' | '500' | '600' | '700' | '800' | '900';

export interface ThemeCustom {
  presetId: string;
  primaryColor:    string; primaryHover:    string;
  secondaryColor:  string; accentColor:     string;
  bgPage:    string; bgCard:    string;
  bgSidebar: string; bgTopbar:  string;
  textPrimary:   string; textSecondary: string; textMuted: string;
  borderColor:   string; borderFocus:   string;
  successColor:  string; dangerColor:   string;
  warningColor:  string; infoColor:     string;
  landingBg:     string; landingAccent: string;
  fontHeading:       string; fontBody:           string;
  fontSizeBase:      number; fontWeightHeading:  FontWeight;
  lineHeight:        string;
  borderRadiusBase:  number;
  buttonShape:       ButtonShape;
  shadowIntensity:   ShadowIntensity;
  sidebarStyle:      SidebarStyle;
  animSpeed:         AnimSpeed;
  customCss:         string;
}

// ── Color Math ────────────────────────────────────────────────────────────────
export function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace('#','');
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}
export function mixWithWhite(hex: string, pct: number): string {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const f = pct/100;
  const n = rgb.map(v => Math.round(v + (255-v)*f));
  return '#'+n.map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function darkenHex(hex: string, pct: number): string {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  const f = 1 - pct/100;
  const n = rgb.map(v => Math.round(v*f));
  return '#'+n.map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function toRgbString(hex: string): string {
  const rgb = hexToRgb(hex); return rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '0,0,0';
}

const SHADOWS: Record<ShadowIntensity,{card:string;btn:string}> = {
  none:   {card:'none',                                              btn:'none'},
  soft:   {card:'0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)', btn:'0 1px 2px rgba(0,0,0,.08)'},
  medium: {card:'0 4px 16px rgba(0,0,0,.09),0 1px 4px rgba(0,0,0,.06)',btn:'0 2px 8px rgba(0,0,0,.12)'},
  strong: {card:'0 8px 32px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.10)',btn:'0 4px 16px rgba(0,0,0,.18)'},
};
const ANIM_MS: Record<AnimSpeed,number> = {off:0,fast:100,normal:220,slow:400};

export const FONT_OPTIONS = [
  {value:'Inter',label:'Inter',category:'sans-serif'},
  {value:'Plus Jakarta Sans',label:'Plus Jakarta Sans',category:'sans-serif'},
  {value:'DM Sans',label:'DM Sans',category:'sans-serif'},
  {value:'Outfit',label:'Outfit',category:'sans-serif'},
  {value:'Sora',label:'Sora',category:'sans-serif'},
  {value:'Nunito',label:'Nunito',category:'sans-serif'},
  {value:'Montserrat',label:'Montserrat',category:'sans-serif'},
  {value:'Raleway',label:'Raleway',category:'sans-serif'},
  {value:'Poppins',label:'Poppins',category:'sans-serif'},
  {value:'Lexend',label:'Lexend',category:'sans-serif'},
  {value:'Work Sans',label:'Work Sans',category:'sans-serif'},
  {value:'Space Grotesk',label:'Space Grotesk',category:'sans-serif'},
  {value:'Bricolage Grotesque',label:'Bricolage Grotesque',category:'sans-serif'},
  {value:'Playfair Display',label:'Playfair Display',category:'serif'},
  {value:'Lora',label:'Lora',category:'serif'},
];

export const themePresets: ThemeCustom[] = [
  {
    presetId:'trust',primaryColor:'#2563eb',primaryHover:'#1d4ed8',secondaryColor:'#1e40af',accentColor:'#60a5fa',
    bgPage:'#f4f4f5',bgCard:'#ffffff',bgSidebar:'#0f172a',bgTopbar:'#ffffff',
    textPrimary:'#0f172a',textSecondary:'#334155',textMuted:'#64748b',
    borderColor:'#e2e8f0',borderFocus:'#2563eb',
    successColor:'#16a34a',dangerColor:'#dc2626',warningColor:'#d97706',infoColor:'#0891b2',
    landingBg:'#060b12',landingAccent:'#2563eb',
    fontHeading:'Inter',fontBody:'Inter',fontSizeBase:14,fontWeightHeading:'700',lineHeight:'1.6',
    borderRadiusBase:12,buttonShape:'rounded',shadowIntensity:'medium',sidebarStyle:'dark',animSpeed:'normal',
    customCss:'',
  },
  {
    presetId:'calm',primaryColor:'#0d9488',primaryHover:'#0f766e',secondaryColor:'#475569',accentColor:'#5eead4',
    bgPage:'#f0fdf9',bgCard:'#ffffff',bgSidebar:'#1e293b',bgTopbar:'#ffffff',
    textPrimary:'#0f2c25',textSecondary:'#334155',textMuted:'#64748b',
    borderColor:'#d1fae5',borderFocus:'#0d9488',
    successColor:'#0d9488',dangerColor:'#e11d48',warningColor:'#ca8a04',infoColor:'#0284c7',
    landingBg:'#03100e',landingAccent:'#0d9488',
    fontHeading:'Poppins',fontBody:'DM Sans',fontSizeBase:14,fontWeightHeading:'700',lineHeight:'1.7',
    borderRadiusBase:16,buttonShape:'rounded',shadowIntensity:'soft',sidebarStyle:'dark',animSpeed:'slow',
    customCss:'',
  },
  {
    presetId:'happy',primaryColor:'#f59e0b',primaryHover:'#d97706',secondaryColor:'#8b5cf6',accentColor:'#fcd34d',
    bgPage:'#fffbeb',bgCard:'#ffffff',bgSidebar:'#1c1033',bgTopbar:'#fffbeb',
    textPrimary:'#1c1917',textSecondary:'#44403c',textMuted:'#78716c',
    borderColor:'#fde68a',borderFocus:'#f59e0b',
    successColor:'#16a34a',dangerColor:'#ef4444',warningColor:'#f59e0b',infoColor:'#6366f1',
    landingBg:'#0c0a1a',landingAccent:'#f59e0b',
    fontHeading:'Nunito',fontBody:'Nunito',fontSizeBase:14,fontWeightHeading:'800',lineHeight:'1.6',
    borderRadiusBase:20,buttonShape:'pill',shadowIntensity:'medium',sidebarStyle:'dark',animSpeed:'fast',
    customCss:'',
  },
  {
    presetId:'corporate',primaryColor:'#0f172a',primaryHover:'#1e293b',secondaryColor:'#334155',accentColor:'#3b82f6',
    bgPage:'#e2e8f0',bgCard:'#f8fafc',bgSidebar:'#020617',bgTopbar:'#f1f5f9',
    textPrimary:'#020617',textSecondary:'#1e293b',textMuted:'#475569',
    borderColor:'#cbd5e1',borderFocus:'#3b82f6',
    successColor:'#15803d',dangerColor:'#b91c1c',warningColor:'#b45309',infoColor:'#075985',
    landingBg:'#010409',landingAccent:'#3b82f6',
    fontHeading:'Space Grotesk',fontBody:'Space Grotesk',fontSizeBase:13,fontWeightHeading:'600',lineHeight:'1.5',
    borderRadiusBase:4,buttonShape:'square',shadowIntensity:'none',sidebarStyle:'dark',animSpeed:'fast',
    customCss:'',
  },
  {
    presetId:'luxury',primaryColor:'#d97706',primaryHover:'#b45309',secondaryColor:'#78350f',accentColor:'#fbbf24',
    bgPage:'#1c1917',bgCard:'#292524',bgSidebar:'#0c0a09',bgTopbar:'#1c1917',
    textPrimary:'#faf7f0',textSecondary:'#e7e5e4',textMuted:'#a8a29e',
    borderColor:'#44403c',borderFocus:'#d97706',
    successColor:'#65a30d',dangerColor:'#ef4444',warningColor:'#d97706',infoColor:'#0ea5e9',
    landingBg:'#0c0a09',landingAccent:'#d97706',
    fontHeading:'Playfair Display',fontBody:'Lora',fontSizeBase:15,fontWeightHeading:'700',lineHeight:'1.7',
    borderRadiusBase:8,buttonShape:'rounded',shadowIntensity:'strong',sidebarStyle:'dark',animSpeed:'slow',
    customCss:'',
  },
];

const loadedFonts = new Set<string>();
export function loadGoogleFont(family: string): void {
  if (loadedFonts.has(family)) return;
  const id = `gf-${family.replace(/\s+/g,'-').toLowerCase()}`;
  if (document.getElementById(id)) { loadedFonts.add(family); return; }
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(family);
}

export function applyTheme(input: string | ThemeCustom): ThemeCustom {
  const theme: ThemeCustom = typeof input === 'string'
    ? (themePresets.find(t => t.presetId === input) || themePresets[0])
    : input;

  loadGoogleFont(theme.fontHeading);
  if (theme.fontBody !== theme.fontHeading) loadGoogleFont(theme.fontBody);

  const p50  = mixWithWhite(theme.primaryColor, 90);
  const p100 = mixWithWhite(theme.primaryColor, 75);
  const p200 = mixWithWhite(theme.primaryColor, 60);
  const p300 = mixWithWhite(theme.primaryColor, 45);
  const p700 = darkenHex(theme.primaryColor, 15);
  const p900 = darkenHex(theme.primaryColor, 40);

  const r = theme.borderRadiusBase;
  const radiusSm   = `${Math.max(2,Math.round(r*0.5))}px`;
  const radiusMd   = `${r}px`;
  const radiusLg   = `${Math.round(r*1.5)}px`;
  const radiusXl   = `${Math.round(r*2)}px`;
  const radiusBtn  = theme.buttonShape==='pill' ? '9999px' : theme.buttonShape==='square' ? `${Math.max(2,Math.round(r*0.3))}px` : radiusMd;

  const shadow = SHADOWS[theme.shadowIntensity];
  const animMs = ANIM_MS[theme.animSpeed];

  const sidebarBg: Record<SidebarStyle,string> = {
    dark:  theme.bgSidebar,
    light: theme.bgCard,
    brand: theme.primaryColor,
    glass: 'rgba(15,23,42,0.65)',
  };
  const sidebarTextColor: Record<SidebarStyle,string> = {
    dark: '#94a3b8', light: theme.textSecondary, brand: 'rgba(255,255,255,0.8)', glass: 'rgba(255,255,255,0.75)',
  };
  const sidebarActiveTextColor: Record<SidebarStyle,string> = {
    dark: '#ffffff', light: theme.primaryColor, brand: '#ffffff', glass: '#ffffff',
  };

  const css = `/* COSGER DYNAMIC THEME — ${theme.presetId} */
:root {
  --t-primary:${theme.primaryColor};--t-primary-h:${theme.primaryHover};
  --t-primary-50:${p50};--t-primary-100:${p100};--t-primary-200:${p200};
  --t-primary-300:${p300};--t-primary-700:${p700};--t-primary-900:${p900};
  --t-primary-rgb:${toRgbString(theme.primaryColor)};
  --t-secondary:${theme.secondaryColor};--t-accent:${theme.accentColor};
  --t-bg-page:${theme.bgPage};--t-bg-card:${theme.bgCard};
  --t-bg-topbar:${theme.bgTopbar};--t-bg-sidebar:${sidebarBg[theme.sidebarStyle]};
  --t-text-primary:${theme.textPrimary};--t-text-secondary:${theme.textSecondary};--t-text-muted:${theme.textMuted};
  --t-border:${theme.borderColor};--t-border-focus:${theme.borderFocus};
  --t-success:${theme.successColor};--t-danger:${theme.dangerColor};
  --t-warning:${theme.warningColor};--t-info:${theme.infoColor};
  --t-landing-bg:${theme.landingBg};--t-landing-accent:${theme.landingAccent};
  --t-font-heading:'${theme.fontHeading}',system-ui,sans-serif;
  --t-font-body:'${theme.fontBody}',system-ui,sans-serif;
  --t-font-size:${theme.fontSizeBase}px;--t-line-height:${theme.lineHeight};
  --t-radius-sm:${radiusSm};--t-radius-md:${radiusMd};--t-radius-lg:${radiusLg};--t-radius-xl:${radiusXl};
  --t-radius-btn:${radiusBtn};--t-radius-full:9999px;
  --t-shadow-card:${shadow.card};--t-shadow-btn:${shadow.btn};
  --t-anim:${animMs}ms;
  --t-sidebar-bg:${sidebarBg[theme.sidebarStyle]};
  --t-sidebar-text:${sidebarTextColor[theme.sidebarStyle]};
  --t-sidebar-active:${sidebarActiveTextColor[theme.sidebarStyle]};
  --color-brand-600:${theme.primaryColor};--color-brand-700:${theme.primaryHover};
  --color-brand-50:${p50};--color-brand-100:${p100};
}
body,html{background-color:${theme.bgPage}!important;font-family:var(--t-font-body)!important;font-size:${theme.fontSizeBase}px!important;line-height:${theme.lineHeight}!important;color:${theme.textPrimary};}
#root{background-color:${theme.bgPage};min-height:100vh;}
${animMs===0?'*,*::before,*::after{transition:none!important;animation-duration:0.01ms!important;}':'*:not(.transition-none){transition-duration:'+animMs+'ms!important;}'}
h1,h2,h3,h4,h5,h6{font-family:var(--t-font-heading)!important;font-weight:${theme.fontWeightHeading}!important;color:${theme.textPrimary};}
/* Brand */
.bg-brand-600,.bg-blue-600{background-color:${theme.primaryColor}!important;}
.bg-brand-700,.bg-blue-700{background-color:${theme.primaryHover}!important;}
.bg-brand-50,.bg-blue-50{background-color:${p50}!important;}
.bg-brand-100,.bg-blue-100{background-color:${p100}!important;}
.hover\\:bg-brand-700:hover,.hover\\:bg-blue-700:hover{background-color:${theme.primaryHover}!important;}
.hover\\:bg-brand-600:hover,.hover\\:bg-blue-600:hover{background-color:${theme.primaryColor}!important;}
.text-brand-600,.text-blue-600{color:${theme.primaryColor}!important;}
.text-brand-700,.text-blue-700{color:${theme.primaryHover}!important;}
.text-brand-400,.text-blue-400{color:${p200}!important;}
.border-brand-600,.border-blue-600{border-color:${theme.primaryColor}!important;}
.border-brand-500,.border-blue-500{border-color:${p300}!important;}
.border-brand-200,.border-blue-200{border-color:${p200}!important;}
.ring-brand-500,.ring-blue-500{--tw-ring-color:${theme.primaryColor}!important;}
.focus\\:ring-brand-500:focus,.focus\\:ring-blue-500:focus{--tw-ring-color:${theme.primaryColor}!important;}
.focus\\:border-brand-500:focus,.focus\\:border-blue-500:focus{border-color:${theme.primaryColor}!important;}
.from-brand-600{--tw-gradient-from:${theme.primaryColor}!important;}
.to-brand-700{--tw-gradient-to:${theme.primaryHover}!important;}
/* Backgrounds */
.bg-white{background-color:${theme.bgCard}!important;}
/* Preserve dark sidebar backgrounds */
#cosger-sidebar .bg-white{background-color:transparent!important;}
#cosger-sidebar .bg-white\/[\d.]+{background-color:transparent!important;}
.bg-slate-50,.bg-gray-50{background-color:${mixWithWhite(theme.bgPage,30)}!important;}
.bg-slate-100,.bg-gray-100{background-color:${mixWithWhite(theme.bgPage,15)}!important;}
/* Text */
.text-slate-900,.text-gray-900{color:${theme.textPrimary}!important;}
.text-slate-800,.text-gray-800{color:${theme.textSecondary}!important;}
.text-slate-700,.text-gray-700{color:${theme.textSecondary}!important;}
.text-slate-600,.text-gray-600{color:${theme.textMuted}!important;}
.text-slate-500,.text-gray-500{color:${theme.textMuted}!important;}
/* Borders */
.border-slate-200,.border-gray-200{border-color:${theme.borderColor}!important;}
.border-slate-100,.border-gray-100{border-color:${mixWithWhite(theme.borderColor,30)}!important;}
.divide-slate-100>*+*,.divide-slate-200>*+*{border-color:${theme.borderColor}!important;}
/* Radius */
.rounded,.rounded-md{border-radius:${radiusSm}!important;}
.rounded-lg,.rounded-xl{border-radius:${radiusMd}!important;}
.rounded-2xl{border-radius:${radiusLg}!important;}
.rounded-3xl{border-radius:${radiusXl}!important;}
button,[type="button"],[type="submit"],[role="button"]{border-radius:${radiusBtn}!important;}
input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),select,textarea{border-radius:${radiusMd}!important;}
/* Shadows */
.shadow,.shadow-sm{box-shadow:${shadow.btn}!important;}
.shadow-md,.shadow-lg{box-shadow:${shadow.card}!important;}
.shadow-xl,.shadow-2xl{box-shadow:${shadow.card}!important;}
/* Sidebar */
#cosger-sidebar{background-color:${sidebarBg[theme.sidebarStyle]}!important;${theme.sidebarStyle==='glass'?'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);':''}border-right-color:${theme.sidebarStyle==='light'?theme.borderColor:'rgba(255,255,255,0.06)'}!important;}
#cosger-sidebar .text-slate-400,#cosger-sidebar .text-slate-300{color:${sidebarTextColor[theme.sidebarStyle]}!important;}
/* Topbar */
#cosger-topbar{background-color:${theme.bgTopbar}!important;border-bottom-color:${theme.borderColor}!important;}
/* ── Semantic: SUCCESS (emerald/green) ─────────────────── */
.bg-green-50,.bg-emerald-50{background-color:${mixWithWhite(theme.successColor,90)}!important;}
.bg-green-100,.bg-emerald-100{background-color:${mixWithWhite(theme.successColor,78)}!important;}
.bg-green-200,.bg-emerald-200{background-color:${mixWithWhite(theme.successColor,60)}!important;}
.bg-green-500,.bg-emerald-500{background-color:${theme.successColor}!important;}
.bg-green-600,.bg-emerald-600{background-color:${darkenHex(theme.successColor,10)}!important;}
.text-green-400,.text-emerald-400{color:${mixWithWhite(theme.successColor,30)}!important;}
.text-green-500,.text-emerald-500{color:${mixWithWhite(theme.successColor,15)}!important;}
.text-green-600,.text-emerald-600{color:${theme.successColor}!important;}
.text-green-700,.text-emerald-700{color:${darkenHex(theme.successColor,10)}!important;}
.border-green-200,.border-emerald-200{border-color:${mixWithWhite(theme.successColor,60)}!important;}
.border-green-300,.border-emerald-300{border-color:${mixWithWhite(theme.successColor,45)}!important;}
.border-emerald-500,.border-green-500{border-color:${theme.successColor}!important;}
/* ── Semantic: DANGER (red) ──────────────────────────── */
.bg-red-50{background-color:${mixWithWhite(theme.dangerColor,90)}!important;}
.bg-red-100{background-color:${mixWithWhite(theme.dangerColor,78)}!important;}
.bg-red-500{background-color:${theme.dangerColor}!important;}
.bg-red-600{background-color:${darkenHex(theme.dangerColor,10)}!important;}
.text-red-400{color:${mixWithWhite(theme.dangerColor,20)}!important;}
.text-red-500{color:${mixWithWhite(theme.dangerColor,8)}!important;}
.text-red-600{color:${theme.dangerColor}!important;}
.text-red-700{color:${darkenHex(theme.dangerColor,10)}!important;}
.border-red-100{border-color:${mixWithWhite(theme.dangerColor,78)}!important;}
.border-red-200{border-color:${mixWithWhite(theme.dangerColor,60)}!important;}
/* ── Semantic: WARNING (amber/yellow) ────────────────── */
.bg-amber-50,.bg-yellow-50{background-color:${mixWithWhite(theme.warningColor,90)}!important;}
.bg-amber-100,.bg-yellow-100{background-color:${mixWithWhite(theme.warningColor,78)}!important;}
.bg-amber-500,.bg-yellow-500{background-color:${theme.warningColor}!important;}
.text-amber-500,.text-yellow-500{color:${mixWithWhite(theme.warningColor,10)}!important;}
.text-amber-600,.text-yellow-600{color:${theme.warningColor}!important;}
.text-amber-700,.text-yellow-700{color:${darkenHex(theme.warningColor,10)}!important;}
.border-amber-200,.border-yellow-200{border-color:${mixWithWhite(theme.warningColor,60)}!important;}
/* Landing */
#cosger-landing{background-color:${theme.landingBg}!important;}
/* Input focus */
input:focus,select:focus,textarea:focus{border-color:${theme.borderFocus}!important;box-shadow:0 0 0 3px rgba(${toRgbString(theme.borderFocus)},0.15)!important;}
/* Custom */
${theme.customCss||''}`;

  let el = document.getElementById('cosger-dynamic-theme') as HTMLStyleElement|null;
  if (!el) { el = document.createElement('style'); el.id='cosger-dynamic-theme'; document.head.appendChild(el); }
  el.textContent = css;
  return theme;
}

export function saveCustomTheme(t: ThemeCustom): void {
  localStorage.setItem('cosger_custom_theme', JSON.stringify(t));
}
export function loadCustomTheme(): ThemeCustom|null {
  try { const r=localStorage.getItem('cosger_custom_theme'); return r?JSON.parse(r):null; } catch { return null; }
}
export function buildTheme(presetId: string, overrides: Partial<ThemeCustom>={}): ThemeCustom {
  const base = themePresets.find(t=>t.presetId===presetId)||themePresets[0];
  return {...base,...overrides,presetId};
}
// Legacy compat
export interface ThemeConfig extends ThemeCustom { id:string; name:string; description:string; }
export default applyTheme;
