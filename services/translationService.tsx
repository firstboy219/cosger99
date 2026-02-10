
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getConfig, saveConfig } from './mockDb';

// --- DICTIONARY DATA ---
// 90% Informal, Fun but Polite for ID
const defaultTranslations: any = {
  id: {
    // Sidebar
    "nav.dashboard": "Markas Komando",
    "nav.ai_strategist": "Otak Ajaib",
    "nav.planning": "Misi & Rencana",
    "nav.my_debts": "Daftar Beban",
    "nav.allocation": "Pos Budget",
    "nav.calendar": "Kalender Sakti",
    "nav.income": "Sumber Cuan",
    "nav.expenses": "Jajan & Bocor",
    "nav.freedom": "Jalan Ninja (Freedom)",
    "nav.team": "Pasukan Keluarga",
    "nav.profile": "Profil Kamu",
    "nav.history": "Riwayat Aktivitas",
    
    // Dashboard
    "dash.welcome": "Halo Sobat Cuan!",
    "dash.subtitle": "Yuk cek kondisi dompet hari ini. Aman atau amsyong?",
    "dash.stat.debt": "Sisa Utang (Duh!)",
    "dash.stat.monthly": "Jatah Setor Bulanan",
    "dash.stat.portfolio": "Jumlah Cicilan",
    "dash.stat.health": "Skor Kesehatan",
    "dash.ai_trigger": "Tanya Dukun AI",
    "dash.btn_add_widget": "Tambah Widget",
    
    // General Actions
    "btn.save": "Gas Simpan",
    "btn.cancel": "Gak Jadi",
    "btn.delete": "Buang Aja",
    "btn.edit": "Oprek",
    "btn.calculate": "Hitung Dong",
    "btn.skip": "Skip Dulu Deh",
    
    // Wizard
    "wiz.welcome": "Woi halo! Aku Paydone AI. Santai, aku di sini bantu beresin keuanganmu.",
    "wiz.ask_income": "To the point aja, sebulan biasanya pegang duit berapa (Gaji + Sampingan)?",
    "wiz.ask_debt": "Nah sekarang bagian paitnya. Ada cicilan apa aja yang lagi jalan? Curhat aja format bebas.",
    "wiz.finish": "Sip mantap! Datanya udah masuk. Yuk langsung ke markas.",
    "wiz.clarify": "Waduh sori, aku agak lemot. Bisa sebut angkanya aja?",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.ai_strategist": "AI Strategist",
    "nav.planning": "Tasks & Plan",
    "nav.my_debts": "My Debts",
    "nav.allocation": "Budgeting",
    "nav.calendar": "Calendar",
    "nav.income": "Income",
    "nav.expenses": "Expenses",
    "nav.freedom": "Financial Freedom",
    "nav.team": "Family Team",
    "nav.profile": "Profile",
    "nav.history": "Activity History",
    
    "dash.welcome": "Hello There!",
    "dash.subtitle": "Here is your financial overview for today.",
    "dash.stat.debt": "Total Outstanding",
    "dash.stat.monthly": "Monthly Payment",
    "dash.stat.portfolio": "Active Loans",
    "dash.stat.health": "Health Score",
    "dash.ai_trigger": "Ask AI",
    "dash.btn_add_widget": "Add Widget",

    "btn.save": "Save Changes",
    "btn.cancel": "Cancel",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.calculate": "Calculate",
    "btn.skip": "Skip for Now",

    "wiz.welcome": "Hi! I'm Paydone AI. I'm here to help organize your finances.",
    "wiz.ask_income": "First thing first, what is your estimated monthly income?",
    "wiz.ask_debt": "Now, do you have any active loans? Feel free to describe them.",
    "wiz.finish": "Awesome! Setup complete. Let's go to dashboard.",
    "wiz.clarify": "Sorry, I didn't get that number. Could you retype just the amount?",
  },
  es: { // Spanish (Mock)
    "nav.dashboard": "Tablero",
    "nav.ai_strategist": "Estratega IA",
    "dash.welcome": "¡Hola Amigo!",
    "dash.subtitle": "Aquí está tu resumen financiero.",
    "btn.save": "Guardar",
    "btn.skip": "Saltar",
  },
  cn: { // Chinese (Mock)
    "nav.dashboard": "仪表板",
    "nav.ai_strategist": "AI 策略师",
    "dash.welcome": "你好，朋友！",
    "dash.subtitle": "这是您今天的财务概览。",
    "btn.save": "保存",
    "btn.skip": "跳过",
  }
};

// --- CONTEXT SETUP ---

type Language = 'id' | 'en' | 'es' | 'cn';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  translations: any;
  updateTranslations: (lang: Language, newDict: any) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('id');
  const [translations, setTranslations] = useState(defaultTranslations);

  // 1. Load from Config / Auto Detect on Mount
  useEffect(() => {
    const conf = getConfig();
    
    // Priority 1: Saved User Preference
    if (conf.language) {
      setLanguageState(conf.language as Language);
      return;
    }

    // Priority 2: Auto Detect from Browser/IP (Simulation)
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.includes('es')) {
        setLanguageState('es');
    } else if (browserLang.includes('zh') || browserLang.includes('cn')) {
        setLanguageState('cn');
    } else if (browserLang.includes('en')) {
        setLanguageState('en');
    } else {
        setLanguageState('id'); // Default fallback
    }
    
    // In real app, you would fetch IPAPI here:
    // fetch('https://ipapi.co/json/').then(r=>r.json()).then(data => { if(data.country_code === 'ES') ... })

  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveConfig({ language: lang }); // Persist
  };

  const updateTranslations = (lang: Language, newDict: any) => {
      setTranslations((prev: any) => ({
          ...prev,
          [lang]: newDict
      }));
      // In real app, save custom dictionary to DB
  };

  const t = (key: string): string => {
    const dict = translations[language] || translations['en'];
    return dict[key] || key; // Fallback to key if missing
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, translations, updateTranslations }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within I18nProvider");
  return context;
};
