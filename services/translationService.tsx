/**
 * translationService.tsx — Paydone i18n + Currency + Timezone Engine v2
 * ───────────────────────────────────────────────────────────────────────────
 * 8 languages: id, en, zh, hi, es, fr, ru, ar
 * Currency follows locale | Timezone: server=UTC, display=user preference
 * Data to backend always in English, frontend translates on receive
 * ───────────────────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getConfig, saveConfig } from './mockDb';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type SupportedLang = 'id' | 'en' | 'zh' | 'hi' | 'es' | 'fr' | 'ru' | 'ar';

export interface LangMeta {
  code: SupportedLang;
  name: string;           // native name
  nameEn: string;         // english name
  flag: string;           // emoji flag
  rtl: boolean;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultCountry: string;
  browserPrefixes: string[];
}

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  flag: string;
  noDecimals: boolean;
}

export interface TZMeta {
  tz: string;
  label: string;
  offset: string;
}

export interface LocalePreference {
  language: SupportedLang;
  currency: string;
  country: string;
  timezone: string;
  isAuto: boolean;       // true = auto from browser
}

// ─── LANGUAGE REGISTRY ────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES: LangMeta[] = [
  { code:'id', name:'Bahasa Indonesia', nameEn:'Indonesian', flag:'🇮🇩', rtl:false, defaultCurrency:'IDR', defaultTimezone:'Asia/Jakarta',    defaultCountry:'ID', browserPrefixes:['id'] },
  { code:'en', name:'English',          nameEn:'English',    flag:'🇺🇸', rtl:false, defaultCurrency:'USD', defaultTimezone:'America/New_York', defaultCountry:'US', browserPrefixes:['en'] },
  { code:'zh', name:'中文',              nameEn:'Chinese',    flag:'🇨🇳', rtl:false, defaultCurrency:'CNY', defaultTimezone:'Asia/Shanghai',    defaultCountry:'CN', browserPrefixes:['zh','cn'] },
  { code:'hi', name:'हिन्दी',           nameEn:'Hindi',      flag:'🇮🇳', rtl:false, defaultCurrency:'INR', defaultTimezone:'Asia/Kolkata',     defaultCountry:'IN', browserPrefixes:['hi'] },
  { code:'es', name:'Español',          nameEn:'Spanish',    flag:'🇪🇸', rtl:false, defaultCurrency:'EUR', defaultTimezone:'Europe/Madrid',    defaultCountry:'ES', browserPrefixes:['es'] },
  { code:'fr', name:'Français',         nameEn:'French',     flag:'🇫🇷', rtl:false, defaultCurrency:'EUR', defaultTimezone:'Europe/Paris',     defaultCountry:'FR', browserPrefixes:['fr'] },
  { code:'ru', name:'Русский',          nameEn:'Russian',    flag:'🇷🇺', rtl:false, defaultCurrency:'RUB', defaultTimezone:'Europe/Moscow',    defaultCountry:'RU', browserPrefixes:['ru'] },
  { code:'ar', name:'العربية',          nameEn:'Arabic',     flag:'🇸🇦', rtl:true,  defaultCurrency:'SAR', defaultTimezone:'Asia/Riyadh',      defaultCountry:'SA', browserPrefixes:['ar'] },
];

// ─── CURRENCY LIST ────────────────────────────────────────────────────────────

export const CURRENCY_LIST: CurrencyMeta[] = [
  { code:'IDR', name:'Indonesian Rupiah', symbol:'Rp',  locale:'id-ID', flag:'🇮🇩', noDecimals:true  },
  { code:'USD', name:'US Dollar',         symbol:'$',   locale:'en-US', flag:'🇺🇸', noDecimals:false },
  { code:'CNY', name:'Chinese Yuan',      symbol:'¥',   locale:'zh-CN', flag:'🇨🇳', noDecimals:false },
  { code:'INR', name:'Indian Rupee',      symbol:'₹',   locale:'hi-IN', flag:'🇮🇳', noDecimals:false },
  { code:'EUR', name:'Euro',              symbol:'€',   locale:'de-DE', flag:'🇪🇺', noDecimals:false },
  { code:'RUB', name:'Russian Ruble',     symbol:'₽',   locale:'ru-RU', flag:'🇷🇺', noDecimals:false },
  { code:'SAR', name:'Saudi Riyal',       symbol:'SR' ,   locale:'ar-SA', flag:'🇸🇦', noDecimals:false },
  { code:'GBP', name:'British Pound',     symbol:'£',   locale:'en-GB', flag:'🇬🇧', noDecimals:false },
  { code:'JPY', name:'Japanese Yen',      symbol:'¥',   locale:'ja-JP', flag:'🇯🇵', noDecimals:true  },
  { code:'KRW', name:'Korean Won',        symbol:'₩',   locale:'ko-KR', flag:'🇰🇷', noDecimals:true  },
  { code:'SGD', name:'Singapore Dollar',  symbol:'S$',  locale:'en-SG', flag:'🇸🇬', noDecimals:false },
  { code:'MYR', name:'Malaysian Ringgit', symbol:'RM',  locale:'ms-MY', flag:'🇲🇾', noDecimals:false },
  { code:'AUD', name:'Australian Dollar', symbol:'A$',  locale:'en-AU', flag:'🇦🇺', noDecimals:false },
  { code:'CAD', name:'Canadian Dollar',   symbol:'C$',  locale:'en-CA', flag:'🇨🇦', noDecimals:false },
  { code:'BRL', name:'Brazilian Real',    symbol:'R$',  locale:'pt-BR', flag:'🇧🇷', noDecimals:false },
];

// ─── TIMEZONE LIST ────────────────────────────────────────────────────────────

export const TIMEZONE_LIST: TZMeta[] = [
  { tz:'UTC',                 label:'UTC — Coordinated Universal Time',     offset:'+00:00' },
  { tz:'Asia/Jakarta',        label:'WIB — Jakarta / Barat (GMT+7)',        offset:'+07:00' },
  { tz:'Asia/Makassar',       label:'WITA — Makassar / Tengah (GMT+8)',     offset:'+08:00' },
  { tz:'Asia/Jayapura',       label:'WIT — Jayapura / Timur (GMT+9)',       offset:'+09:00' },
  { tz:'Asia/Shanghai',       label:'CST — Shanghai / Beijing (GMT+8)',     offset:'+08:00' },
  { tz:'Asia/Tokyo',          label:'JST — Tokyo (GMT+9)',                  offset:'+09:00' },
  { tz:'Asia/Seoul',          label:'KST — Seoul (GMT+9)',                  offset:'+09:00' },
  { tz:'Asia/Kolkata',        label:'IST — India (GMT+5:30)',               offset:'+05:30' },
  { tz:'Asia/Singapore',      label:'SGT — Singapore (GMT+8)',              offset:'+08:00' },
  { tz:'Asia/Kuala_Lumpur',   label:'MYT — Kuala Lumpur (GMT+8)',           offset:'+08:00' },
  { tz:'Asia/Riyadh',         label:'AST — Saudi Arabia (GMT+3)',           offset:'+03:00' },
  { tz:'Asia/Dubai',          label:'GST — Dubai (GMT+4)',                  offset:'+04:00' },
  { tz:'Asia/Karachi',        label:'PKT — Karachi (GMT+5)',                offset:'+05:00' },
  { tz:'Asia/Dhaka',          label:'BST — Dhaka (GMT+6)',                  offset:'+06:00' },
  { tz:'Europe/London',       label:'GMT — London (UTC+0/+1 DST)',         offset:'+00:00' },
  { tz:'Europe/Paris',        label:'CET — Paris / Berlin (UTC+1/+2 DST)', offset:'+01:00' },
  { tz:'Europe/Moscow',       label:'MSK — Moscow (UTC+3)',                 offset:'+03:00' },
  { tz:'America/New_York',    label:'EST — New York (UTC-5/-4 DST)',        offset:'-05:00' },
  { tz:'America/Chicago',     label:'CST — Chicago (UTC-6/-5 DST)',        offset:'-06:00' },
  { tz:'America/Los_Angeles', label:'PST — Los Angeles (UTC-8/-7 DST)',    offset:'-08:00' },
  { tz:'America/Sao_Paulo',   label:'BRT — São Paulo (UTC-3)',             offset:'-03:00' },
  { tz:'Australia/Sydney',    label:'AEST — Sydney (UTC+10/+11 DST)',      offset:'+10:00' },
  { tz:'Pacific/Auckland',    label:'NZST — Auckland (UTC+12/+13 DST)',    offset:'+12:00' },
];

// ─── TRANSLATION DICTIONARY ────────────────────────────────────────────────────
// Keys are dot-notation. Backend values always English.
// All 8 languages are fully translated.

const T: Record<SupportedLang, Record<string, string>> = {

  // ── INDONESIAN ──────────────────────────────────────────────────────────────
  id: {
    // Nav
    'nav.dashboard':'Markas Komando','nav.ai_strategist':'Otak Ajaib','nav.planning':'Misi & Rencana',
    'nav.my_debts':'Daftar Beban','nav.allocation':'Pos Budget','nav.calendar':'Kalender Sakti',
    'nav.income':'Sumber Cuan','nav.expenses':'Jajan & Bocor','nav.freedom':'Jalan Ninja',
    'nav.team':'Pasukan Keluarga','nav.profile':'Profil Kamu','nav.history':'Riwayat Aktivitas',
    'nav.simulator':'Simulator Cuan','nav.sinking_fund':'Dana Cadangan','nav.upgrade':'Upgrade Paket',
    // Dashboard
    'dash.welcome':'Halo, Sobat Cuan!','dash.subtitle':'Yuk cek kondisi dompet hari ini.',
    'dash.stat.debt':'Sisa Hutang','dash.stat.monthly':'Cicilan Bulanan',
    'dash.stat.portfolio':'Jumlah Cicilan','dash.stat.health':'Skor Kesehatan',
    'dash.ai_trigger':'Tanya AI','dash.health_score':'Skor Kesehatan',
    'dash.net_cashflow':'Cashflow Bersih','dash.emergency_fund':'Dana Darurat',
    'dash.expense_ratio':'Rasio Pengeluaran',
    // Charts
    'chart.month':'Bulan','chart.amount':'Jumlah','chart.income':'Pemasukan',
    'chart.expense':'Pengeluaran','chart.debt':'Hutang','chart.savings':'Tabungan',
    'chart.balance':'Saldo','chart.target':'Target','chart.actual':'Aktual','chart.projection':'Proyeksi',
    'chart.Jan':'Jan','chart.Feb':'Feb','chart.Mar':'Mar','chart.Apr':'Apr','chart.May':'Mei',
    'chart.Jun':'Jun','chart.Jul':'Jul','chart.Aug':'Agu','chart.Sep':'Sep',
    'chart.Oct':'Okt','chart.Nov':'Nov','chart.Dec':'Des',
    // Debts
    'debt.title':'Daftar Hutang','debt.name':'Nama Hutang','debt.total':'Total Hutang',
    'debt.monthly':'Angsuran/Bln','debt.remaining':'Sisa Hutang','debt.interest':'Bunga (%)',
    'debt.end_date':'Tanggal Lunas','debt.type':'Jenis','debt.add':'Tambah Hutang',
    'debt.no_debt':'Kamu bebas hutang! 🎉',
    'debttype.KPR':'KPR (Rumah)','debttype.KKB':'KKB (Kendaraan)','debttype.KTA':'KTA (Tanpa Agunan)',
    'debttype.CC':'Kartu Kredit','debttype.STUDENT':'Kredit Pelajar',
    'debttype.BUSINESS':'Kredit Usaha','debttype.PERSONAL':'Pinjaman Pribadi','debttype.OTHER':'Lainnya',
    // Income
    'income.title':'Sumber Pemasukan','income.source':'Sumber','income.amount':'Jumlah',
    'income.type':'Tipe','income.date':'Tanggal','income.add':'Catat Pemasukan',
    'incometype.SALARY':'Gaji','incometype.FREELANCE':'Freelance','incometype.BUSINESS':'Bisnis',
    'incometype.INVESTMENT':'Investasi','incometype.PASSIVE':'Pasif','incometype.OTHER':'Lainnya',
    // Expenses
    'expense.title':'Pengeluaran','expense.date':'Tanggal','expense.category':'Kategori',
    'expense.amount':'Jumlah','expense.notes':'Catatan','expense.add':'Catat Pengeluaran',
    'cat.Food':'Makan & Minum','cat.Transport':'Transportasi','cat.Shopping':'Belanja',
    'cat.Utilities':'Tagihan & Utilitas','cat.Entertainment':'Hiburan','cat.Health':'Kesehatan',
    'cat.Education':'Pendidikan','cat.Others':'Lainnya',
    // Tasks
    'task.title':'Tugas & Rencana','task.name':'Nama Tugas','task.due':'Tenggat',
    'task.priority':'Prioritas','task.status':'Status','task.add':'Tambah Tugas',
    'priority.HIGH':'Tinggi','priority.MEDIUM':'Sedang','priority.LOW':'Rendah',
    'status.PENDING':'Belum','status.IN_PROGRESS':'Proses','status.DONE':'Selesai',
    // Allocation
    'alloc.title':'Pos Anggaran','alloc.name':'Nama Pos','alloc.amount':'Anggaran',
    'alloc.category':'Kategori','alloc.add':'Tambah Pos',
    'alloccat.NEEDS':'Kebutuhan','alloccat.WANTS':'Keinginan','alloccat.SAVINGS':'Tabungan','alloccat.DEBT':'Cicilan',
    // Sinking Fund
    'sf.title':'Dana Cadangan','sf.name':'Nama Dana','sf.target':'Target',
    'sf.current':'Terkumpul','sf.deadline':'Deadline','sf.add':'Buat Dana Baru',
    // Profile / Locale
    'profile.title':'Profil & Pengaturan','profile.locale_tab':'Bahasa & Lokasi',
    'profile.lang':'Bahasa Aplikasi','profile.currency':'Mata Uang',
    'profile.country':'Negara','profile.timezone':'Zona Waktu',
    'profile.auto_detect':'Otomatis (dari browser)',
    'profile.save_locale':'Simpan Preferensi','profile.lang_saved':'Preferensi bahasa tersimpan!',
    'profile.name':'Nama Tampilan','profile.email':'Email',
    'profile.password':'Password Baru','profile.confirm_pw':'Konfirmasi Password',
    'profile.save':'Simpan Semua Perubahan','profile.saving':'Menyimpan...','profile.saved':'Berhasil disimpan!',
    'profile.err_pw':'Password tidak cocok','profile.goal':'Target Kebebasan Finansial',
    'profile.account_tab':'Akun','profile.locale_desc':'Atur bahasa, mata uang, negara, dan zona waktu',
    'profile.lang_auto_hint':'Mode AUTO: bahasa akan terdeteksi dari pengaturan browser',
    'profile.lang_manual_hint':'Mode MANUAL: pilih bahasa, currency, dan timezone sendiri',
    'profile.current_time':'Waktu Lokal Kamu',
    // Buttons
    'btn.save':'Simpan','btn.cancel':'Batal','btn.delete':'Hapus','btn.edit':'Ubah',
    'btn.calculate':'Hitung','btn.skip':'Lewati','btn.add':'Tambah','btn.confirm':'Konfirmasi',
    'btn.close':'Tutup','btn.back':'Kembali','btn.next':'Lanjut','btn.refresh':'Muat Ulang',
    // Common
    'common.loading':'Memuat...','common.saving':'Menyimpan...','common.success':'Berhasil!',
    'common.error':'Gagal!','common.empty':'Belum ada data','common.total':'Total',
    'common.monthly':'Per Bulan','common.yearly':'Per Tahun','common.active':'Aktif',
    'common.inactive':'Tidak Aktif','common.yes':'Ya','common.no':'Tidak',
    'common.optional':'Opsional','common.required':'Wajib diisi',
    'common.date':'Tanggal','common.today':'Hari ini','common.month':'Bulan','common.year':'Tahun',
    'common.dsr':'DSR (Rasio Cicilan)','common.runway':'Runway (Bln)',
    'common.health':'Kesehatan','common.good':'Baik','common.warning':'Waspada','common.critical':'Kritis',
    'common.months':'bulan','common.years':'tahun',
    // Wizard
    'wiz.welcome':'Halo! Aku Paydone AI. Santai, aku di sini bantu beresin keuanganmu.',
    'wiz.ask_income':'Sebulan biasanya pegang duit berapa? (Gaji + Sampingan)',
    'wiz.ask_debt':'Ada cicilan yang lagi jalan? Cerita aja bebas.',
    'wiz.finish':'Sip mantap! Data masuk. Yuk ke dashboard.','wiz.clarify':'Sori, bisa sebut angkanya aja?',
    'incometype.ACTIVE':'Aktif (Kerja)',
    'incometype.PASSIVE':'Pasif (Aset)',
    'incometype.WINDFALL':'Bonus/THR',
    'status.OVERDUE':'Terlambat',
  },

  // ── ENGLISH ─────────────────────────────────────────────────────────────────
  en: {
    'nav.dashboard':'Dashboard','nav.ai_strategist':'AI Strategist','nav.planning':'Tasks & Plan',
    'nav.my_debts':'My Debts','nav.allocation':'Budgeting','nav.calendar':'Calendar',
    'nav.income':'Income','nav.expenses':'Expenses','nav.freedom':'Financial Freedom',
    'nav.team':'Family Team','nav.profile':'Profile','nav.history':'Activity History',
    'nav.simulator':'Simulator','nav.sinking_fund':'Sinking Fund','nav.upgrade':'Upgrade Plan',
    'dash.welcome':'Hello!','dash.subtitle':"Here's your financial overview.",
    'dash.stat.debt':'Total Debt','dash.stat.monthly':'Monthly Payment',
    'dash.stat.portfolio':'Active Loans','dash.stat.health':'Health Score',
    'dash.ai_trigger':'Ask AI','dash.health_score':'Health Score',
    'dash.net_cashflow':'Net Cashflow','dash.emergency_fund':'Emergency Fund',
    'dash.expense_ratio':'Expense Ratio',
    'chart.month':'Month','chart.amount':'Amount','chart.income':'Income',
    'chart.expense':'Expense','chart.debt':'Debt','chart.savings':'Savings',
    'chart.balance':'Balance','chart.target':'Target','chart.actual':'Actual','chart.projection':'Projection',
    'chart.Jan':'Jan','chart.Feb':'Feb','chart.Mar':'Mar','chart.Apr':'Apr','chart.May':'May',
    'chart.Jun':'Jun','chart.Jul':'Jul','chart.Aug':'Aug','chart.Sep':'Sep',
    'chart.Oct':'Oct','chart.Nov':'Nov','chart.Dec':'Dec',
    'debt.title':'My Debts','debt.name':'Name','debt.total':'Total',
    'debt.monthly':'Monthly','debt.remaining':'Remaining','debt.interest':'Interest (%)',
    'debt.end_date':'Payoff Date','debt.type':'Type','debt.add':'Add Debt',
    'debt.no_debt':"You're debt-free! 🎉",
    'debttype.KPR':'Mortgage','debttype.KKB':'Auto Loan','debttype.KTA':'Personal Loan',
    'debttype.CC':'Credit Card','debttype.STUDENT':'Student Loan',
    'debttype.BUSINESS':'Business Loan','debttype.PERSONAL':'Personal Loan','debttype.OTHER':'Other',
    'income.title':'Income','income.source':'Source','income.amount':'Amount',
    'income.type':'Type','income.date':'Date','income.add':'Add Income',
    'incometype.SALARY':'Salary','incometype.FREELANCE':'Freelance','incometype.BUSINESS':'Business',
    'incometype.INVESTMENT':'Investment','incometype.PASSIVE':'Passive','incometype.OTHER':'Other',
    'expense.title':'Expenses','expense.date':'Date','expense.category':'Category',
    'expense.amount':'Amount','expense.notes':'Notes','expense.add':'Add Expense',
    'cat.Food':'Food & Drinks','cat.Transport':'Transport','cat.Shopping':'Shopping',
    'cat.Utilities':'Utilities','cat.Entertainment':'Entertainment','cat.Health':'Health',
    'cat.Education':'Education','cat.Others':'Others',
    'task.title':'Tasks & Plan','task.name':'Task Name','task.due':'Due Date',
    'task.priority':'Priority','task.status':'Status','task.add':'Add Task',
    'priority.HIGH':'High','priority.MEDIUM':'Medium','priority.LOW':'Low',
    'status.PENDING':'Pending','status.IN_PROGRESS':'In Progress','status.DONE':'Done',
    'alloc.title':'Budget Allocation','alloc.name':'Name','alloc.amount':'Budget',
    'alloc.category':'Category','alloc.add':'Add Budget',
    'alloccat.NEEDS':'Needs','alloccat.WANTS':'Wants','alloccat.SAVINGS':'Savings','alloccat.DEBT':'Debt Payment',
    'sf.title':'Sinking Fund','sf.name':'Fund Name','sf.target':'Target',
    'sf.current':'Saved','sf.deadline':'Deadline','sf.add':'New Fund',
    'profile.title':'Profile & Settings','profile.locale_tab':'Language & Locale',
    'profile.lang':'App Language','profile.currency':'Currency',
    'profile.country':'Country','profile.timezone':'Timezone',
    'profile.auto_detect':'Auto (from browser)',
    'profile.save_locale':'Save Preferences','profile.lang_saved':'Preferences saved!',
    'profile.name':'Display Name','profile.email':'Email',
    'profile.password':'New Password','profile.confirm_pw':'Confirm Password',
    'profile.save':'Save Changes','profile.saving':'Saving...','profile.saved':'Saved!',
    'profile.err_pw':"Passwords don't match",'profile.goal':'Financial Freedom Target',
    'profile.account_tab':'Account','profile.locale_desc':'Set your language, currency, country & timezone',
    'profile.lang_auto_hint':'AUTO mode: language is detected from your browser settings',
    'profile.lang_manual_hint':'MANUAL mode: choose your language, currency & timezone',
    'profile.current_time':'Your Local Time',
    'btn.save':'Save','btn.cancel':'Cancel','btn.delete':'Delete','btn.edit':'Edit',
    'btn.calculate':'Calculate','btn.skip':'Skip','btn.add':'Add','btn.confirm':'Confirm',
    'btn.close':'Close','btn.back':'Back','btn.next':'Next','btn.refresh':'Refresh',
    'common.loading':'Loading...','common.saving':'Saving...','common.success':'Success!',
    'common.error':'Error!','common.empty':'No data yet','common.total':'Total',
    'common.monthly':'Monthly','common.yearly':'Yearly','common.active':'Active',
    'common.inactive':'Inactive','common.yes':'Yes','common.no':'No',
    'common.optional':'Optional','common.required':'Required',
    'common.date':'Date','common.today':'Today','common.month':'Month','common.year':'Year',
    'common.dsr':'DSR (Debt-to-Income)','common.runway':'Runway (Mo)',
    'common.health':'Health','common.good':'Good','common.warning':'Warning','common.critical':'Critical',
    'common.months':'months','common.years':'years',
    'wiz.welcome':"Hi! I'm Paydone AI. Let me help organize your finances.",
    'wiz.ask_income':"What's your estimated monthly income?",
    'wiz.ask_debt':"Do you have any active loans? Describe them freely.",
    'wiz.finish':"Great! Setup complete. Let's go to dashboard.",'wiz.clarify':"Sorry, could you type just the number?",
    'incometype.ACTIVE':'Active (Work)',
    'incometype.PASSIVE':'Passive (Asset)',
    'incometype.WINDFALL':'Bonus/Windfall',
    'status.OVERDUE':'Overdue',
  },

  // ── CHINESE ──────────────────────────────────────────────────────────────────
  zh: {
    'nav.dashboard':'总控台','nav.ai_strategist':'AI策略师','nav.planning':'任务计划',
    'nav.my_debts':'我的债务','nav.allocation':'预算分配','nav.calendar':'日历',
    'nav.income':'收入','nav.expenses':'支出','nav.freedom':'财务自由',
    'nav.team':'家庭团队','nav.profile':'个人资料','nav.history':'活动历史',
    'nav.simulator':'模拟器','nav.sinking_fund':'专项基金','nav.upgrade':'升级计划',
    'dash.welcome':'您好！','dash.subtitle':'查看您今天的财务状况。',
    'dash.stat.debt':'总负债','dash.stat.monthly':'月还款',
    'dash.stat.portfolio':'贷款数量','dash.stat.health':'健康分',
    'dash.ai_trigger':'问AI','dash.health_score':'财务健康',
    'dash.net_cashflow':'净现金流','dash.emergency_fund':'紧急备用金',
    'dash.expense_ratio':'支出比率',
    'chart.month':'月份','chart.amount':'金额','chart.income':'收入',
    'chart.expense':'支出','chart.debt':'债务','chart.savings':'储蓄',
    'chart.balance':'余额','chart.target':'目标','chart.actual':'实际','chart.projection':'预测',
    'chart.Jan':'1月','chart.Feb':'2月','chart.Mar':'3月','chart.Apr':'4月','chart.May':'5月',
    'chart.Jun':'6月','chart.Jul':'7月','chart.Aug':'8月','chart.Sep':'9月',
    'chart.Oct':'10月','chart.Nov':'11月','chart.Dec':'12月',
    'debt.title':'我的债务','debt.name':'名称','debt.total':'总额',
    'debt.monthly':'月还款','debt.remaining':'剩余','debt.interest':'利率(%)',
    'debt.end_date':'还清日期','debt.type':'类型','debt.add':'添加债务',
    'debt.no_debt':'无负债！🎉',
    'debttype.KPR':'房贷','debttype.KKB':'车贷','debttype.KTA':'消费贷',
    'debttype.CC':'信用卡','debttype.STUDENT':'助学贷款',
    'debttype.BUSINESS':'商业贷款','debttype.PERSONAL':'个人贷款','debttype.OTHER':'其他',
    'income.title':'收入','income.source':'来源','income.amount':'金额',
    'income.type':'类型','income.date':'日期','income.add':'记录收入',
    'incometype.SALARY':'工资','incometype.FREELANCE':'自由职业','incometype.BUSINESS':'商业',
    'incometype.INVESTMENT':'投资','incometype.PASSIVE':'被动收入','incometype.OTHER':'其他',
    'expense.title':'支出','expense.date':'日期','expense.category':'类别',
    'expense.amount':'金额','expense.notes':'备注','expense.add':'记录支出',
    'cat.Food':'餐饮','cat.Transport':'交通','cat.Shopping':'购物',
    'cat.Utilities':'水电费','cat.Entertainment':'娱乐','cat.Health':'医疗',
    'cat.Education':'教育','cat.Others':'其他',
    'task.title':'任务计划','task.name':'任务名','task.due':'截止日',
    'task.priority':'优先级','task.status':'状态','task.add':'添加任务',
    'priority.HIGH':'高','priority.MEDIUM':'中','priority.LOW':'低',
    'status.PENDING':'待办','status.IN_PROGRESS':'进行中','status.DONE':'完成',
    'alloc.title':'预算分配','alloc.name':'名称','alloc.amount':'预算',
    'alloc.category':'类别','alloc.add':'添加预算',
    'alloccat.NEEDS':'必需品','alloccat.WANTS':'想要','alloccat.SAVINGS':'储蓄','alloccat.DEBT':'还款',
    'sf.title':'专项基金','sf.name':'基金名称','sf.target':'目标',
    'sf.current':'已存','sf.deadline':'截止日','sf.add':'新建基金',
    'profile.title':'个人资料','profile.locale_tab':'语言与地区',
    'profile.lang':'应用语言','profile.currency':'货币',
    'profile.country':'国家','profile.timezone':'时区',
    'profile.auto_detect':'自动检测（从浏览器）',
    'profile.save_locale':'保存首选项','profile.lang_saved':'首选项已保存！',
    'profile.name':'显示名称','profile.email':'邮箱',
    'profile.password':'新密码','profile.confirm_pw':'确认密码',
    'profile.save':'保存更改','profile.saving':'保存中...','profile.saved':'已保存！',
    'profile.err_pw':'密码不匹配','profile.goal':'财务自由目标',
    'profile.account_tab':'账户','profile.locale_desc':'设置语言、货币、国家和时区',
    'profile.lang_auto_hint':'AUTO模式：语言从浏览器设置自动检测',
    'profile.lang_manual_hint':'手动模式：自行选择语言、货币和时区',
    'profile.current_time':'您的本地时间',
    'btn.save':'保存','btn.cancel':'取消','btn.delete':'删除','btn.edit':'编辑',
    'btn.calculate':'计算','btn.skip':'跳过','btn.add':'添加','btn.confirm':'确认',
    'btn.close':'关闭','btn.back':'返回','btn.next':'下一步','btn.refresh':'刷新',
    'common.loading':'加载中...','common.saving':'保存中...','common.success':'成功！',
    'common.error':'错误！','common.empty':'暂无数据','common.total':'合计',
    'common.monthly':'每月','common.yearly':'每年','common.active':'活跃',
    'common.inactive':'不活跃','common.yes':'是','common.no':'否',
    'common.optional':'可选','common.required':'必填',
    'common.date':'日期','common.today':'今天','common.month':'月','common.year':'年',
    'common.dsr':'负债比率','common.runway':'备用期(月)',
    'common.health':'健康','common.good':'良好','common.warning':'警告','common.critical':'危险',
    'common.months':'个月','common.years':'年',
    'wiz.welcome':'您好！我是Paydone AI，帮您整理财务。',
    'wiz.ask_income':'您的月收入大约是多少？',
    'wiz.ask_debt':'您有哪些贷款？请随意描述。',
    'wiz.finish':'太好了！设置完成。前往仪表板。','wiz.clarify':'抱歉，能只输入数字吗？',
    'incometype.ACTIVE':'主动收入',
    'incometype.PASSIVE':'被动收入',
    'incometype.WINDFALL':'奖金/意外',
    'status.OVERDUE':'逾期',
  },

  // ── HINDI ────────────────────────────────────────────────────────────────────
  hi: {
    'nav.dashboard':'डैशबोर्ड','nav.ai_strategist':'AI रणनीतिकार','nav.planning':'कार्य योजना',
    'nav.my_debts':'मेरे ऋण','nav.allocation':'बजट','nav.calendar':'कैलेंडर',
    'nav.income':'आय','nav.expenses':'खर्च','nav.freedom':'वित्तीय स्वतंत्रता',
    'nav.team':'परिवार','nav.profile':'प्रोफ़ाइल','nav.history':'गतिविधि इतिहास',
    'nav.simulator':'सिमुलेटर','nav.sinking_fund':'सिंकिंग फंड','nav.upgrade':'अपग्रेड',
    'dash.welcome':'नमस्ते!','dash.subtitle':'आज का आपका वित्तीय सारांश।',
    'dash.stat.debt':'कुल ऋण','dash.stat.monthly':'मासिक भुगतान',
    'dash.stat.portfolio':'सक्रिय ऋण','dash.stat.health':'स्वास्थ्य स्कोर',
    'dash.ai_trigger':'AI से पूछें','dash.health_score':'वित्तीय स्वास्थ्य',
    'dash.net_cashflow':'नेट कैशफ्लो','dash.emergency_fund':'आपातकालीन निधि',
    'dash.expense_ratio':'व्यय अनुपात',
    'chart.month':'महीना','chart.amount':'राशि','chart.income':'आय',
    'chart.expense':'खर्च','chart.debt':'ऋण','chart.savings':'बचत',
    'chart.balance':'शेष','chart.target':'लक्ष्य','chart.actual':'वास्तविक','chart.projection':'अनुमान',
    'chart.Jan':'जन','chart.Feb':'फ़र','chart.Mar':'मार','chart.Apr':'अप्र','chart.May':'मई',
    'chart.Jun':'जून','chart.Jul':'जुल','chart.Aug':'अग','chart.Sep':'सित',
    'chart.Oct':'अक्त','chart.Nov':'नव','chart.Dec':'दिस',
    'debt.title':'मेरे ऋण','debt.name':'नाम','debt.total':'कुल',
    'debt.monthly':'मासिक','debt.remaining':'शेष','debt.interest':'ब्याज(%)',
    'debt.end_date':'चुकौती तिथि','debt.type':'प्रकार','debt.add':'ऋण जोड़ें',
    'debt.no_debt':'ऋण मुक्त! 🎉',
    'debttype.KPR':'होम लोन','debttype.KKB':'कार लोन','debttype.KTA':'व्यक्तिगत ऋण',
    'debttype.CC':'क्रेडिट कार्ड','debttype.STUDENT':'शिक्षा ऋण',
    'debttype.BUSINESS':'व्यावसायिक ऋण','debttype.PERSONAL':'व्यक्तिगत ऋण','debttype.OTHER':'अन्य',
    'income.title':'आय','income.source':'स्रोत','income.amount':'राशि',
    'income.type':'प्रकार','income.date':'तिथि','income.add':'आय जोड़ें',
    'incometype.SALARY':'वेतन','incometype.FREELANCE':'फ्रीलांस','incometype.BUSINESS':'व्यवसाय',
    'incometype.INVESTMENT':'निवेश','incometype.PASSIVE':'निष्क्रिय','incometype.OTHER':'अन्य',
    'expense.title':'खर्च','expense.date':'तिथि','expense.category':'श्रेणी',
    'expense.amount':'राशि','expense.notes':'नोट्स','expense.add':'खर्च जोड़ें',
    'cat.Food':'खाना-पीना','cat.Transport':'परिवहन','cat.Shopping':'खरीदारी',
    'cat.Utilities':'उपयोगिताएं','cat.Entertainment':'मनोरंजन','cat.Health':'स्वास्थ्य',
    'cat.Education':'शिक्षा','cat.Others':'अन्य',
    'task.title':'कार्य योजना','task.name':'कार्य नाम','task.due':'नियत तिथि',
    'task.priority':'प्राथमिकता','task.status':'स्थिति','task.add':'कार्य जोड़ें',
    'priority.HIGH':'उच्च','priority.MEDIUM':'मध्यम','priority.LOW':'निम्न',
    'status.PENDING':'लंबित','status.IN_PROGRESS':'प्रगति में','status.DONE':'पूर्ण',
    'alloc.title':'बजट आवंटन','alloc.name':'नाम','alloc.amount':'बजट',
    'alloc.category':'श्रेणी','alloc.add':'बजट जोड़ें',
    'alloccat.NEEDS':'ज़रूरतें','alloccat.WANTS':'इच्छाएं','alloccat.SAVINGS':'बचत','alloccat.DEBT':'ऋण भुगतान',
    'sf.title':'सिंकिंग फंड','sf.name':'फंड नाम','sf.target':'लक्ष्य',
    'sf.current':'बचाया','sf.deadline':'समयसीमा','sf.add':'नया फंड',
    'profile.title':'प्रोफ़ाइल','profile.locale_tab':'भाषा और क्षेत्र',
    'profile.lang':'ऐप भाषा','profile.currency':'मुद्रा',
    'profile.country':'देश','profile.timezone':'समय क्षेत्र',
    'profile.auto_detect':'स्वतः (ब्राउज़र से)',
    'profile.save_locale':'प्राथमिकताएं सहेजें','profile.lang_saved':'सहेजा गया!',
    'profile.name':'प्रदर्शन नाम','profile.email':'ईमेल',
    'profile.password':'नया पासवर्ड','profile.confirm_pw':'पासवर्ड की पुष्टि',
    'profile.save':'परिवर्तन सहेजें','profile.saving':'सहेज रहे हैं...','profile.saved':'सहेजा गया!',
    'profile.err_pw':'पासवर्ड मेल नहीं खाते','profile.goal':'वित्तीय स्वतंत्रता लक्ष्य',
    'profile.account_tab':'खाता','profile.locale_desc':'भाषा, मुद्रा, देश और समय क्षेत्र सेट करें',
    'profile.lang_auto_hint':'AUTO मोड: भाषा ब्राउज़र सेटिंग से स्वतः पहचानी जाती है',
    'profile.lang_manual_hint':'मैन्युअल मोड: भाषा, मुद्रा और समय क्षेत्र स्वयं चुनें',
    'profile.current_time':'आपका स्थानीय समय',
    'btn.save':'सहेजें','btn.cancel':'रद्द करें','btn.delete':'हटाएं','btn.edit':'संपादित करें',
    'btn.calculate':'गणना','btn.skip':'छोड़ें','btn.add':'जोड़ें','btn.confirm':'पुष्टि',
    'btn.close':'बंद करें','btn.back':'वापस','btn.next':'अगला','btn.refresh':'रीफ्रेश',
    'common.loading':'लोड हो रहा है...','common.saving':'सहेज रहे हैं...','common.success':'सफल!',
    'common.error':'त्रुटि!','common.empty':'कोई डेटा नहीं','common.total':'कुल',
    'common.monthly':'मासिक','common.yearly':'वार्षिक','common.active':'सक्रिय',
    'common.inactive':'निष्क्रिय','common.yes':'हां','common.no':'नहीं',
    'common.optional':'वैकल्पिक','common.required':'आवश्यक',
    'common.date':'तिथि','common.today':'आज','common.month':'महीना','common.year':'वर्ष',
    'common.dsr':'ऋण अनुपात','common.runway':'रनवे(मो)',
    'common.health':'स्वास्थ्य','common.good':'अच्छा','common.warning':'चेतावनी','common.critical':'गंभीर',
    'common.months':'महीने','common.years':'वर्ष',
    'wiz.welcome':'नमस्ते! मैं Paydone AI हूँ। वित्त व्यवस्था में मदद करूंगा।',
    'wiz.ask_income':'आपकी अनुमानित मासिक आय कितनी है?',
    'wiz.ask_debt':'क्या आपके कोई सक्रिय ऋण हैं? स्वतंत्र रूप से बताएं।',
    'wiz.finish':'बढ़िया! सेटअप पूर्ण।','wiz.clarify':'माफ करें, केवल संख्या टाइप करें।',
    'incometype.ACTIVE':'सक्रिय आय',
    'incometype.PASSIVE':'निष्क्रिय आय',
    'incometype.WINDFALL':'बोनस/आकस्मिक',
    'status.OVERDUE':'अतिदेय',
  },

  // ── SPANISH ──────────────────────────────────────────────────────────────────
  es: {
    'nav.dashboard':'Tablero','nav.ai_strategist':'Estratega IA','nav.planning':'Tareas y Plan',
    'nav.my_debts':'Mis Deudas','nav.allocation':'Presupuesto','nav.calendar':'Calendario',
    'nav.income':'Ingresos','nav.expenses':'Gastos','nav.freedom':'Libertad Financiera',
    'nav.team':'Equipo Familiar','nav.profile':'Perfil','nav.history':'Historial',
    'nav.simulator':'Simulador','nav.sinking_fund':'Fondo de Reserva','nav.upgrade':'Actualizar Plan',
    'dash.welcome':'¡Hola!','dash.subtitle':'Resumen financiero de hoy.',
    'dash.stat.debt':'Deuda Total','dash.stat.monthly':'Pago Mensual',
    'dash.stat.portfolio':'Préstamos Activos','dash.stat.health':'Puntuación Salud',
    'dash.ai_trigger':'Preguntar a IA','dash.health_score':'Salud Financiera',
    'dash.net_cashflow':'Flujo de Caja','dash.emergency_fund':'Fondo de Emergencia',
    'dash.expense_ratio':'Ratio de Gastos',
    'chart.month':'Mes','chart.amount':'Monto','chart.income':'Ingresos',
    'chart.expense':'Gastos','chart.debt':'Deuda','chart.savings':'Ahorros',
    'chart.balance':'Saldo','chart.target':'Objetivo','chart.actual':'Real','chart.projection':'Proyección',
    'chart.Jan':'Ene','chart.Feb':'Feb','chart.Mar':'Mar','chart.Apr':'Abr','chart.May':'May',
    'chart.Jun':'Jun','chart.Jul':'Jul','chart.Aug':'Ago','chart.Sep':'Sep',
    'chart.Oct':'Oct','chart.Nov':'Nov','chart.Dec':'Dic',
    'debt.title':'Mis Deudas','debt.name':'Nombre','debt.total':'Total',
    'debt.monthly':'Mensual','debt.remaining':'Restante','debt.interest':'Interés(%)',
    'debt.end_date':'Fecha pago','debt.type':'Tipo','debt.add':'Agregar Deuda',
    'debt.no_debt':'¡Sin deudas! 🎉',
    'debttype.KPR':'Hipoteca','debttype.KKB':'Préstamo Auto','debttype.KTA':'Préstamo Personal',
    'debttype.CC':'Tarjeta Crédito','debttype.STUDENT':'Préstamo Estudiantil',
    'debttype.BUSINESS':'Préstamo Empresarial','debttype.PERSONAL':'Préstamo Personal','debttype.OTHER':'Otro',
    'income.title':'Ingresos','income.source':'Fuente','income.amount':'Monto',
    'income.type':'Tipo','income.date':'Fecha','income.add':'Agregar Ingreso',
    'incometype.SALARY':'Salario','incometype.FREELANCE':'Autónomo','incometype.BUSINESS':'Negocio',
    'incometype.INVESTMENT':'Inversión','incometype.PASSIVE':'Pasivo','incometype.OTHER':'Otro',
    'expense.title':'Gastos','expense.date':'Fecha','expense.category':'Categoría',
    'expense.amount':'Monto','expense.notes':'Notas','expense.add':'Agregar Gasto',
    'cat.Food':'Comida y Bebida','cat.Transport':'Transporte','cat.Shopping':'Compras',
    'cat.Utilities':'Servicios','cat.Entertainment':'Entretenimiento','cat.Health':'Salud',
    'cat.Education':'Educación','cat.Others':'Otros',
    'task.title':'Tareas y Plan','task.name':'Tarea','task.due':'Fecha límite',
    'task.priority':'Prioridad','task.status':'Estado','task.add':'Agregar Tarea',
    'priority.HIGH':'Alta','priority.MEDIUM':'Media','priority.LOW':'Baja',
    'status.PENDING':'Pendiente','status.IN_PROGRESS':'En Progreso','status.DONE':'Completado',
    'alloc.title':'Presupuesto','alloc.name':'Nombre','alloc.amount':'Monto',
    'alloc.category':'Categoría','alloc.add':'Agregar Presupuesto',
    'alloccat.NEEDS':'Necesidades','alloccat.WANTS':'Deseos','alloccat.SAVINGS':'Ahorros','alloccat.DEBT':'Deuda',
    'sf.title':'Fondo de Reserva','sf.name':'Nombre','sf.target':'Meta',
    'sf.current':'Ahorrado','sf.deadline':'Fecha límite','sf.add':'Nuevo Fondo',
    'profile.title':'Perfil y Configuración','profile.locale_tab':'Idioma y Región',
    'profile.lang':'Idioma','profile.currency':'Moneda',
    'profile.country':'País','profile.timezone':'Zona Horaria',
    'profile.auto_detect':'Automático (del navegador)',
    'profile.save_locale':'Guardar Preferencias','profile.lang_saved':'¡Guardado!',
    'profile.name':'Nombre','profile.email':'Correo electrónico',
    'profile.password':'Nueva Contraseña','profile.confirm_pw':'Confirmar Contraseña',
    'profile.save':'Guardar Cambios','profile.saving':'Guardando...','profile.saved':'¡Guardado!',
    'profile.err_pw':'Las contraseñas no coinciden','profile.goal':'Meta Libertad Financiera',
    'profile.account_tab':'Cuenta','profile.locale_desc':'Configura idioma, moneda, país y zona horaria',
    'profile.lang_auto_hint':'Modo AUTO: el idioma se detecta automáticamente del navegador',
    'profile.lang_manual_hint':'Modo MANUAL: elige tu idioma, moneda y zona horaria',
    'profile.current_time':'Tu Hora Local',
    'btn.save':'Guardar','btn.cancel':'Cancelar','btn.delete':'Eliminar','btn.edit':'Editar',
    'btn.calculate':'Calcular','btn.skip':'Omitir','btn.add':'Agregar','btn.confirm':'Confirmar',
    'btn.close':'Cerrar','btn.back':'Atrás','btn.next':'Siguiente','btn.refresh':'Actualizar',
    'common.loading':'Cargando...','common.saving':'Guardando...','common.success':'¡Éxito!',
    'common.error':'¡Error!','common.empty':'Sin datos','common.total':'Total',
    'common.monthly':'Mensual','common.yearly':'Anual','common.active':'Activo',
    'common.inactive':'Inactivo','common.yes':'Sí','common.no':'No',
    'common.optional':'Opcional','common.required':'Requerido',
    'common.date':'Fecha','common.today':'Hoy','common.month':'Mes','common.year':'Año',
    'common.dsr':'Ratio de Deuda','common.runway':'Reserva(mes)',
    'common.health':'Salud','common.good':'Bueno','common.warning':'Advertencia','common.critical':'Crítico',
    'common.months':'meses','common.years':'años',
    'wiz.welcome':'¡Hola! Soy Paydone AI. Te ayudaré a organizar tus finanzas.',
    'wiz.ask_income':'¿Cuál es tu ingreso mensual estimado?',
    'wiz.ask_debt':'¿Tienes préstamos activos? Descríbelos libremente.',
    'wiz.finish':'¡Genial! Configuración completa.','wiz.clarify':'Lo siento, ¿puedes escribir solo el número?',
    'incometype.ACTIVE':'Activo (Trabajo)',
    'incometype.PASSIVE':'Pasivo (Activo)',
    'incometype.WINDFALL':'Bono/Extra',
    'status.OVERDUE':'Vencido',
  },

  // ── FRENCH ───────────────────────────────────────────────────────────────────
  fr: {
    'nav.dashboard':'Tableau de bord','nav.ai_strategist':'Stratège IA','nav.planning':'Tâches et Plan',
    'nav.my_debts':'Mes Dettes','nav.allocation':'Budget','nav.calendar':'Calendrier',
    'nav.income':'Revenus','nav.expenses':'Dépenses','nav.freedom':'Liberté Financière',
    'nav.team':'Équipe Familiale','nav.profile':'Profil','nav.history':'Historique',
    'nav.simulator':'Simulateur','nav.sinking_fund':'Fonds de Réserve','nav.upgrade':'Mettre à niveau',
    'dash.welcome':'Bonjour !','dash.subtitle':'Voici votre aperçu financier.',
    'dash.stat.debt':'Dette Totale','dash.stat.monthly':'Paiement Mensuel',
    'dash.stat.portfolio':'Prêts Actifs','dash.stat.health':'Score de Santé',
    'dash.ai_trigger':'Demander à IA','dash.health_score':'Santé Financière',
    'dash.net_cashflow':'Flux de Trésorerie','dash.emergency_fund':"Fonds d'Urgence",
    'dash.expense_ratio':'Ratio de Dépenses',
    'chart.month':'Mois','chart.amount':'Montant','chart.income':'Revenus',
    'chart.expense':'Dépenses','chart.debt':'Dette','chart.savings':'Épargne',
    'chart.balance':'Solde','chart.target':'Objectif','chart.actual':'Réel','chart.projection':'Projection',
    'chart.Jan':'Jan','chart.Feb':'Fév','chart.Mar':'Mar','chart.Apr':'Avr','chart.May':'Mai',
    'chart.Jun':'Jun','chart.Jul':'Jul','chart.Aug':'Aoû','chart.Sep':'Sep',
    'chart.Oct':'Oct','chart.Nov':'Nov','chart.Dec':'Déc',
    'debt.title':'Mes Dettes','debt.name':'Nom','debt.total':'Total',
    'debt.monthly':'Mensuel','debt.remaining':'Restant','debt.interest':'Intérêt(%)',
    'debt.end_date':'Date remboursement','debt.type':'Type','debt.add':'Ajouter une dette',
    'debt.no_debt':'Sans dettes ! 🎉',
    'debttype.KPR':'Prêt Immobilier','debttype.KKB':'Prêt Auto','debttype.KTA':'Prêt Personnel',
    'debttype.CC':'Carte de Crédit','debttype.STUDENT':'Prêt Étudiant',
    'debttype.BUSINESS':'Prêt Commercial','debttype.PERSONAL':'Prêt Personnel','debttype.OTHER':'Autre',
    'income.title':'Revenus','income.source':'Source','income.amount':'Montant',
    'income.type':'Type','income.date':'Date','income.add':'Ajouter un revenu',
    'incometype.SALARY':'Salaire','incometype.FREELANCE':'Freelance','incometype.BUSINESS':'Entreprise',
    'incometype.INVESTMENT':'Investissement','incometype.PASSIVE':'Passif','incometype.OTHER':'Autre',
    'expense.title':'Dépenses','expense.date':'Date','expense.category':'Catégorie',
    'expense.amount':'Montant','expense.notes':'Notes','expense.add':'Ajouter une dépense',
    'cat.Food':'Alimentation','cat.Transport':'Transport','cat.Shopping':'Shopping',
    'cat.Utilities':'Services','cat.Entertainment':'Loisirs','cat.Health':'Santé',
    'cat.Education':'Éducation','cat.Others':'Autres',
    'task.title':'Tâches et Plan','task.name':'Tâche','task.due':'Échéance',
    'task.priority':'Priorité','task.status':'Statut','task.add':'Ajouter une tâche',
    'priority.HIGH':'Haute','priority.MEDIUM':'Moyenne','priority.LOW':'Basse',
    'status.PENDING':'En attente','status.IN_PROGRESS':'En cours','status.DONE':'Terminé',
    'alloc.title':'Budget','alloc.name':'Nom','alloc.amount':'Budget',
    'alloc.category':'Catégorie','alloc.add':'Ajouter un budget',
    'alloccat.NEEDS':'Besoins','alloccat.WANTS':'Envies','alloccat.SAVINGS':'Épargne','alloccat.DEBT':'Remboursement',
    'sf.title':'Fonds de Réserve','sf.name':'Nom du fonds','sf.target':'Objectif',
    'sf.current':'Économisé','sf.deadline':'Échéance','sf.add':'Nouveau fonds',
    'profile.title':'Profil et Paramètres','profile.locale_tab':'Langue et Région',
    'profile.lang':'Langue','profile.currency':'Devise',
    'profile.country':'Pays','profile.timezone':'Fuseau Horaire',
    'profile.auto_detect':'Automatique (du navigateur)',
    'profile.save_locale':'Sauvegarder les préférences','profile.lang_saved':'Préférences sauvegardées !',
    'profile.name':'Nom affiché','profile.email':'E-mail',
    'profile.password':'Nouveau Mot de Passe','profile.confirm_pw':'Confirmer le mot de passe',
    'profile.save':'Sauvegarder','profile.saving':'Sauvegarde...','profile.saved':'Sauvegardé !',
    'profile.err_pw':'Les mots de passe ne correspondent pas','profile.goal':'Objectif Liberté Financière',
    'profile.account_tab':'Compte','profile.locale_desc':'Configurez langue, devise, pays et fuseau horaire',
    'profile.lang_auto_hint':'Mode AUTO : la langue est détectée automatiquement depuis le navigateur',
    'profile.lang_manual_hint':'Mode MANUEL : choisissez votre langue, devise et fuseau horaire',
    'profile.current_time':'Votre Heure Locale',
    'btn.save':'Sauvegarder','btn.cancel':'Annuler','btn.delete':'Supprimer','btn.edit':'Modifier',
    'btn.calculate':'Calculer','btn.skip':'Passer','btn.add':'Ajouter','btn.confirm':'Confirmer',
    'btn.close':'Fermer','btn.back':'Retour','btn.next':'Suivant','btn.refresh':'Actualiser',
    'common.loading':'Chargement...','common.saving':'Sauvegarde...','common.success':'Succès !',
    'common.error':'Erreur !','common.empty':'Aucune donnée','common.total':'Total',
    'common.monthly':'Mensuel','common.yearly':'Annuel','common.active':'Actif',
    'common.inactive':'Inactif','common.yes':'Oui','common.no':'Non',
    'common.optional':'Optionnel','common.required':'Requis',
    'common.date':'Date','common.today':"Aujourd'hui",'common.month':'Mois','common.year':'Année',
    'common.dsr':'Ratio Endettement','common.runway':'Réserve(mois)',
    'common.health':'Santé','common.good':'Bien','common.warning':'Attention','common.critical':'Critique',
    'common.months':'mois','common.years':'ans',
    'wiz.welcome':"Bonjour ! Je suis Paydone AI. Je vais vous aider à organiser vos finances.",
    'wiz.ask_income':'Quel est votre revenu mensuel estimé ?',
    'wiz.ask_debt':'Avez-vous des prêts actifs ? Décrivez-les librement.',
    'wiz.finish':'Parfait ! Configuration terminée.','wiz.clarify':'Désolé, pouvez-vous écrire seulement le nombre ?',
    'incometype.ACTIVE':'Actif (Travail)',
    'incometype.PASSIVE':'Passif (Actif)',
    'incometype.WINDFALL':'Bonus/Prime',
    'status.OVERDUE':'En retard',
  },

  // ── RUSSIAN ──────────────────────────────────────────────────────────────────
  ru: {
    'nav.dashboard':'Панель','nav.ai_strategist':'ИИ Стратег','nav.planning':'Задачи и план',
    'nav.my_debts':'Мои долги','nav.allocation':'Бюджет','nav.calendar':'Календарь',
    'nav.income':'Доходы','nav.expenses':'Расходы','nav.freedom':'Финансовая свобода',
    'nav.team':'Семья','nav.profile':'Профиль','nav.history':'История',
    'nav.simulator':'Симулятор','nav.sinking_fund':'Резервный фонд','nav.upgrade':'Обновить план',
    'dash.welcome':'Привет!','dash.subtitle':'Ваш финансовый обзор сегодня.',
    'dash.stat.debt':'Общий долг','dash.stat.monthly':'Ежемесячный платёж',
    'dash.stat.portfolio':'Активные займы','dash.stat.health':'Финансовое здоровье',
    'dash.ai_trigger':'Спросить ИИ','dash.health_score':'Здоровье',
    'dash.net_cashflow':'Чистый денежный поток','dash.emergency_fund':'Резервный фонд',
    'dash.expense_ratio':'Соотношение расходов',
    'chart.month':'Месяц','chart.amount':'Сумма','chart.income':'Доходы',
    'chart.expense':'Расходы','chart.debt':'Долг','chart.savings':'Сбережения',
    'chart.balance':'Баланс','chart.target':'Цель','chart.actual':'Факт','chart.projection':'Прогноз',
    'chart.Jan':'Янв','chart.Feb':'Фев','chart.Mar':'Мар','chart.Apr':'Апр','chart.May':'Май',
    'chart.Jun':'Июн','chart.Jul':'Июл','chart.Aug':'Авг','chart.Sep':'Сен',
    'chart.Oct':'Окт','chart.Nov':'Ноя','chart.Dec':'Дек',
    'debt.title':'Мои долги','debt.name':'Название','debt.total':'Итого',
    'debt.monthly':'Ежемесячно','debt.remaining':'Остаток','debt.interest':'Ставка(%)',
    'debt.end_date':'Дата погашения','debt.type':'Тип','debt.add':'Добавить долг',
    'debt.no_debt':'Нет долгов! 🎉',
    'debttype.KPR':'Ипотека','debttype.KKB':'Автокредит','debttype.KTA':'Потребкредит',
    'debttype.CC':'Кредитная карта','debttype.STUDENT':'Студенческий кредит',
    'debttype.BUSINESS':'Бизнес-кредит','debttype.PERSONAL':'Личный кредит','debttype.OTHER':'Другое',
    'income.title':'Доходы','income.source':'Источник','income.amount':'Сумма',
    'income.type':'Тип','income.date':'Дата','income.add':'Добавить доход',
    'incometype.SALARY':'Зарплата','incometype.FREELANCE':'Фриланс','incometype.BUSINESS':'Бизнес',
    'incometype.INVESTMENT':'Инвестиции','incometype.PASSIVE':'Пассивный','incometype.OTHER':'Другое',
    'expense.title':'Расходы','expense.date':'Дата','expense.category':'Категория',
    'expense.amount':'Сумма','expense.notes':'Заметки','expense.add':'Добавить расход',
    'cat.Food':'Еда и напитки','cat.Transport':'Транспорт','cat.Shopping':'Покупки',
    'cat.Utilities':'Коммунальные услуги','cat.Entertainment':'Развлечения','cat.Health':'Здоровье',
    'cat.Education':'Образование','cat.Others':'Другое',
    'task.title':'Задачи и план','task.name':'Задача','task.due':'Срок',
    'task.priority':'Приоритет','task.status':'Статус','task.add':'Добавить задачу',
    'priority.HIGH':'Высокий','priority.MEDIUM':'Средний','priority.LOW':'Низкий',
    'status.PENDING':'Ожидает','status.IN_PROGRESS':'В процессе','status.DONE':'Выполнено',
    'alloc.title':'Бюджет','alloc.name':'Название','alloc.amount':'Бюджет',
    'alloc.category':'Категория','alloc.add':'Добавить бюджет',
    'alloccat.NEEDS':'Потребности','alloccat.WANTS':'Желания','alloccat.SAVINGS':'Сбережения','alloccat.DEBT':'Долг',
    'sf.title':'Резервный фонд','sf.name':'Название фонда','sf.target':'Цель',
    'sf.current':'Накоплено','sf.deadline':'Срок','sf.add':'Новый фонд',
    'profile.title':'Профиль и настройки','profile.locale_tab':'Язык и регион',
    'profile.lang':'Язык приложения','profile.currency':'Валюта',
    'profile.country':'Страна','profile.timezone':'Часовой пояс',
    'profile.auto_detect':'Авто (из браузера)',
    'profile.save_locale':'Сохранить настройки','profile.lang_saved':'Настройки сохранены!',
    'profile.name':'Имя пользователя','profile.email':'Email',
    'profile.password':'Новый пароль','profile.confirm_pw':'Подтвердить пароль',
    'profile.save':'Сохранить изменения','profile.saving':'Сохраняю...','profile.saved':'Сохранено!',
    'profile.err_pw':'Пароли не совпадают','profile.goal':'Цель финансовой свободы',
    'profile.account_tab':'Аккаунт','profile.locale_desc':'Настройте язык, валюту, страну и часовой пояс',
    'profile.lang_auto_hint':'Режим AUTO: язык определяется автоматически из браузера',
    'profile.lang_manual_hint':'Ручной режим: выберите язык, валюту и часовой пояс вручную',
    'profile.current_time':'Ваше местное время',
    'btn.save':'Сохранить','btn.cancel':'Отмена','btn.delete':'Удалить','btn.edit':'Изменить',
    'btn.calculate':'Рассчитать','btn.skip':'Пропустить','btn.add':'Добавить','btn.confirm':'Подтвердить',
    'btn.close':'Закрыть','btn.back':'Назад','btn.next':'Далее','btn.refresh':'Обновить',
    'common.loading':'Загрузка...','common.saving':'Сохранение...','common.success':'Успешно!',
    'common.error':'Ошибка!','common.empty':'Нет данных','common.total':'Итого',
    'common.monthly':'Ежемесячно','common.yearly':'Ежегодно','common.active':'Активный',
    'common.inactive':'Неактивный','common.yes':'Да','common.no':'Нет',
    'common.optional':'Необязательно','common.required':'Обязательно',
    'common.date':'Дата','common.today':'Сегодня','common.month':'Месяц','common.year':'Год',
    'common.dsr':'Долговая нагрузка','common.runway':'Резерв(мес)',
    'common.health':'Здоровье','common.good':'Хорошо','common.warning':'Предупреждение','common.critical':'Критично',
    'common.months':'месяцев','common.years':'лет',
    'wiz.welcome':'Привет! Я Paydone AI. Помогу вам организовать финансы.',
    'wiz.ask_income':'Каков ваш примерный ежемесячный доход?',
    'wiz.ask_debt':'Есть ли у вас активные займы? Опишите свободно.',
    'wiz.finish':'Отлично! Настройка завершена.','wiz.clarify':'Извините, введите только число.',
    'incometype.ACTIVE':'Активный (Работа)',
    'incometype.PASSIVE':'Пассивный (Активы)',
    'incometype.WINDFALL':'Бонус/Разовый',
    'status.OVERDUE':'Просроченный',
  },

  // ── ARABIC ───────────────────────────────────────────────────────────────────
  ar: {
    'nav.dashboard':'لوحة التحكم','nav.ai_strategist':'مستراتيج الذكاء','nav.planning':'المهام والخطة',
    'nav.my_debts':'ديوني','nav.allocation':'الميزانية','nav.calendar':'التقويم',
    'nav.income':'الدخل','nav.expenses':'المصروفات','nav.freedom':'الحرية المالية',
    'nav.team':'الفريق العائلي','nav.profile':'الملف الشخصي','nav.history':'سجل النشاط',
    'nav.simulator':'المحاكي','nav.sinking_fund':'صندوق الاحتياط','nav.upgrade':'ترقية الخطة',
    'dash.welcome':'مرحباً!','dash.subtitle':'نظرة عامة على أموالك اليوم.',
    'dash.stat.debt':'إجمالي الديون','dash.stat.monthly':'الدفع الشهري',
    'dash.stat.portfolio':'القروض النشطة','dash.stat.health':'نقاط الصحة',
    'dash.ai_trigger':'اسأل الذكاء الاصطناعي','dash.health_score':'الصحة المالية',
    'dash.net_cashflow':'صافي التدفق النقدي','dash.emergency_fund':'صندوق الطوارئ',
    'dash.expense_ratio':'نسبة المصروفات',
    'chart.month':'الشهر','chart.amount':'المبلغ','chart.income':'الدخل',
    'chart.expense':'المصروفات','chart.debt':'الديون','chart.savings':'المدخرات',
    'chart.balance':'الرصيد','chart.target':'الهدف','chart.actual':'الفعلي','chart.projection':'التوقعات',
    'chart.Jan':'يناير','chart.Feb':'فبراير','chart.Mar':'مارس','chart.Apr':'أبريل','chart.May':'مايو',
    'chart.Jun':'يونيو','chart.Jul':'يوليو','chart.Aug':'أغسطس','chart.Sep':'سبتمبر',
    'chart.Oct':'أكتوبر','chart.Nov':'نوفمبر','chart.Dec':'ديسمبر',
    'debt.title':'ديوني','debt.name':'الاسم','debt.total':'الإجمالي',
    'debt.monthly':'شهري','debt.remaining':'المتبقي','debt.interest':'الفائدة(%)',
    'debt.end_date':'تاريخ السداد','debt.type':'النوع','debt.add':'إضافة دين',
    'debt.no_debt':'خالٍ من الديون! 🎉',
    'debttype.KPR':'قرض عقاري','debttype.KKB':'قرض سيارة','debttype.KTA':'قرض شخصي',
    'debttype.CC':'بطاقة ائتمان','debttype.STUDENT':'قرض طلابي',
    'debttype.BUSINESS':'قرض تجاري','debttype.PERSONAL':'قرض شخصي','debttype.OTHER':'أخرى',
    'income.title':'الدخل','income.source':'المصدر','income.amount':'المبلغ',
    'income.type':'النوع','income.date':'التاريخ','income.add':'إضافة دخل',
    'incometype.SALARY':'الراتب','incometype.FREELANCE':'عمل حر','incometype.BUSINESS':'أعمال',
    'incometype.INVESTMENT':'استثمار','incometype.PASSIVE':'دخل سلبي','incometype.OTHER':'أخرى',
    'expense.title':'المصروفات','expense.date':'التاريخ','expense.category':'الفئة',
    'expense.amount':'المبلغ','expense.notes':'ملاحظات','expense.add':'إضافة مصروف',
    'cat.Food':'طعام ومشروبات','cat.Transport':'مواصلات','cat.Shopping':'تسوق',
    'cat.Utilities':'فواتير','cat.Entertainment':'ترفيه','cat.Health':'صحة',
    'cat.Education':'تعليم','cat.Others':'أخرى',
    'task.title':'المهام والخطة','task.name':'المهمة','task.due':'الموعد النهائي',
    'task.priority':'الأولوية','task.status':'الحالة','task.add':'إضافة مهمة',
    'priority.HIGH':'عالية','priority.MEDIUM':'متوسطة','priority.LOW':'منخفضة',
    'status.PENDING':'معلق','status.IN_PROGRESS':'قيد التنفيذ','status.DONE':'مكتمل',
    'alloc.title':'توزيع الميزانية','alloc.name':'الاسم','alloc.amount':'الميزانية',
    'alloc.category':'الفئة','alloc.add':'إضافة ميزانية',
    'alloccat.NEEDS':'الاحتياجات','alloccat.WANTS':'الرغبات','alloccat.SAVINGS':'مدخرات','alloccat.DEBT':'سداد ديون',
    'sf.title':'صندوق الاحتياط','sf.name':'اسم الصندوق','sf.target':'الهدف',
    'sf.current':'المدخر','sf.deadline':'الموعد النهائي','sf.add':'صندوق جديد',
    'profile.title':'الملف الشخصي','profile.locale_tab':'اللغة والمنطقة',
    'profile.lang':'لغة التطبيق','profile.currency':'العملة',
    'profile.country':'الدولة','profile.timezone':'المنطقة الزمنية',
    'profile.auto_detect':'تلقائي (من المتصفح)',
    'profile.save_locale':'حفظ التفضيلات','profile.lang_saved':'تم الحفظ!',
    'profile.name':'الاسم','profile.email':'البريد الإلكتروني',
    'profile.password':'كلمة مرور جديدة','profile.confirm_pw':'تأكيد كلمة المرور',
    'profile.save':'حفظ التغييرات','profile.saving':'جاري الحفظ...','profile.saved':'تم الحفظ!',
    'profile.err_pw':'كلمات المرور غير متطابقة','profile.goal':'هدف الحرية المالية',
    'profile.account_tab':'الحساب','profile.locale_desc':'اضبط اللغة والعملة والدولة والمنطقة الزمنية',
    'profile.lang_auto_hint':'وضع AUTO: اللغة تُكتشف تلقائياً من إعدادات المتصفح',
    'profile.lang_manual_hint':'الوضع اليدوي: اختر اللغة والعملة والمنطقة الزمنية بنفسك',
    'profile.current_time':'وقتك المحلي',
    'btn.save':'حفظ','btn.cancel':'إلغاء','btn.delete':'حذف','btn.edit':'تعديل',
    'btn.calculate':'احسب','btn.skip':'تخطي','btn.add':'إضافة','btn.confirm':'تأكيد',
    'btn.close':'إغلاق','btn.back':'رجوع','btn.next':'التالي','btn.refresh':'تحديث',
    'common.loading':'تحميل...','common.saving':'حفظ...','common.success':'نجح!',
    'common.error':'خطأ!','common.empty':'لا توجد بيانات','common.total':'الإجمالي',
    'common.monthly':'شهري','common.yearly':'سنوي','common.active':'نشط',
    'common.inactive':'غير نشط','common.yes':'نعم','common.no':'لا',
    'common.optional':'اختياري','common.required':'مطلوب',
    'common.date':'التاريخ','common.today':'اليوم','common.month':'الشهر','common.year':'السنة',
    'common.dsr':'نسبة الدين','common.runway':'احتياطي(شهر)',
    'common.health':'الصحة','common.good':'جيد','common.warning':'تحذير','common.critical':'حرج',
    'common.months':'أشهر','common.years':'سنوات',
    'wiz.welcome':'مرحباً! أنا Paydone AI. سأساعدك في تنظيم أموالك.',
    'wiz.ask_income':'ما هو دخلك الشهري التقريبي؟',
    'wiz.ask_debt':'هل لديك قروض نشطة؟ صفها بحرية.',
    'wiz.finish':'رائع! اكتمل الإعداد.','wiz.clarify':'آسف، هل يمكنك كتابة الرقم فقط؟',
    'incometype.ACTIVE':'نشط (عمل)',
    'incometype.PASSIVE':'سلبي (أصول)',
    'incometype.WINDFALL':'مكافأة/طارئ',
    'status.OVERDUE':'متأخر',
  },
};

// ─── LOCALE STORAGE ───────────────────────────────────────────────────────────

const LOCALE_KEY = 'paydone_locale_v2';

export function detectBrowserLocale(): LocalePreference {
  const bl = (navigator.language || (navigator.languages && navigator.languages[0]) || 'en').toLowerCase();
  const matched = SUPPORTED_LANGUAGES.find(l => l.browserPrefixes.some(p => bl.startsWith(p)))
    ?? SUPPORTED_LANGUAGES.find(l => l.code === 'en')!;
  return { language: matched.code, currency: matched.defaultCurrency,
    country: matched.defaultCountry, timezone: matched.defaultTimezone, isAuto: true };
}

export function loadLocalePreference(): LocalePreference {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as LocalePreference;
      if (SUPPORTED_LANGUAGES.find(l => l.code === p.language)) return p;
    }
  } catch {}
  // fallback: legacy config.language
  try {
    const conf = getConfig();
    if (conf.language) {
      const l = SUPPORTED_LANGUAGES.find(x => x.code === conf.language);
      if (l) return { language: l.code, currency: l.defaultCurrency,
        country: l.defaultCountry, timezone: l.defaultTimezone, isAuto: false };
    }
  } catch {}
  return detectBrowserLocale();
}

export function saveLocalePreference(p: LocalePreference): void {
  localStorage.setItem(LOCALE_KEY, JSON.stringify(p));
  try { saveConfig({ language: p.language }); } catch {}
}

// ─── CURRENCY FORMATTER ───────────────────────────────────────────────────────

export function formatCurrencyI18n(amount: number, currencyCode: string, compact = false): string {
  const meta = CURRENCY_LIST.find(c => c.code === currencyCode) ?? CURRENCY_LIST[1];
  const sym = meta.symbol;
  const loc = meta.locale;
  const nd = meta.noDecimals;
  try {
    if (compact) {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 1_000_000_000) return `${sign}${sym}${(abs/1e9).toLocaleString(loc,{maximumFractionDigits:1})}B`;
      if (abs >= 1_000_000)     return `${sign}${sym}${(abs/1e6).toLocaleString(loc,{maximumFractionDigits:1})}M`;
      if (abs >= 1_000)         return `${sign}${sym}${(abs/1e3).toLocaleString(loc,{maximumFractionDigits:1})}K`;
      return `${sign}${sym}${abs.toLocaleString(loc,{maximumFractionDigits:0})}`;
    }
    if (currencyCode === 'IDR') return `Rp\u00A0${Math.round(amount).toLocaleString('id-ID')}`;
    return new Intl.NumberFormat(loc, {
      style: 'currency', currency: currencyCode,
      minimumFractionDigits: nd ? 0 : 2, maximumFractionDigits: nd ? 0 : 2,
    }).format(amount);
  } catch {
    return `${sym}${amount.toLocaleString()}`;
  }
}

// ─── TIMEZONE UTILITIES ───────────────────────────────────────────────────────

export function formatDateTZ(
  d: string | Date | null | undefined,
  tz: string,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (!d) return '-';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('default', { timeZone: tz,
      year:'numeric', month:'short', day:'numeric', ...opts }).format(date);
  } catch { return String(d).substring(0, 10); }
}

export function formatDateTimeTZ(
  d: string | Date | null | undefined,
  tz: string,
  lang: SupportedLang = 'en'
): string {
  if (!d) return '-';
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '-';
    const locale = SUPPORTED_LANGUAGES.find(l => l.code === lang)?.browserPrefixes[0] || 'en';
    return new Intl.DateTimeFormat(locale, { timeZone: tz,
      year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(date);
  } catch { return String(d).substring(0, 16); }
}

export function getLocalDateString(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

export function getTZOffsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName:'short' })
      .formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || tz;
  } catch { return tz; }
}

export function getCurrentTimeInTZ(tz: string): string {
  try {
    return new Intl.DateTimeFormat('default', {
      timeZone: tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false
    }).format(new Date());
  } catch { return '--:--:--'; }
}

// ─── DATA TRANSLATORS (Backend English → UI locale) ───────────────────────────
// Backend stores values in English. Never change what gets sent/stored.

export function translateDebtType(v: string, t: (k: string) => string): string {
  const m: Record<string,string> = { KPR:'debttype.KPR', KKB:'debttype.KKB', KTA:'debttype.KTA',
    CC:'debttype.CC', STUDENT:'debttype.STUDENT', BUSINESS:'debttype.BUSINESS',
    PERSONAL:'debttype.PERSONAL', OTHER:'debttype.OTHER' };
  return t(m[v?.toUpperCase()] ?? 'debttype.OTHER');
}
export function translateCategory(v: string, t: (k: string) => string): string {
  const m: Record<string,string> = { Food:'cat.Food', Transport:'cat.Transport', Shopping:'cat.Shopping',
    Utilities:'cat.Utilities', Entertainment:'cat.Entertainment', Health:'cat.Health',
    Education:'cat.Education', Others:'cat.Others' };
  return t(m[v] ?? 'cat.Others');
}
export function translatePriority(v: string, t: (k: string) => string): string {
  const m: Record<string,string> = { high:'priority.HIGH', medium:'priority.MEDIUM', low:'priority.LOW' };
  return t(m[v?.toLowerCase()] ?? 'priority.MEDIUM');
}
export function translateStatus(v: string, t: (k: string) => string): string {
  const m: Record<string,string> = {
    pending:     'status.PENDING',
    in_progress: 'status.IN_PROGRESS',
    done:        'status.DONE',
    completed:   'status.DONE',    // Planning.tsx uses 'completed' for done
    paid:        'status.DONE',    // Installments use 'paid'
    overdue:     'status.OVERDUE',
  };
  return t(m[v?.toLowerCase()] ?? v ?? '');
}
export function translateIncomeType(v: string, t: (k: string) => string): string {
  // Backend stores: 'active' | 'passive' | 'windfall'
  // Translation maps to display labels per language
  const m: Record<string,string> = {
    // Current backend values
    active:   'incometype.ACTIVE',
    passive:  'incometype.PASSIVE',
    windfall: 'incometype.WINDFALL',
    // Legacy / alternative values
    salary:     'incometype.SALARY',
    freelance:  'incometype.FREELANCE',
    business:   'incometype.BUSINESS',
    investment: 'incometype.INVESTMENT',
    other:      'incometype.OTHER',
  };
  return t(m[v?.toLowerCase()] ?? v ?? '');
}
export function translateAllocCategory(v: string, t: (k: string) => string): string {
  const m: Record<string,string> = { needs:'alloccat.NEEDS', wants:'alloccat.WANTS',
    savings:'alloccat.SAVINGS', debt:'alloccat.DEBT' };
  return t(m[v?.toLowerCase()] ?? 'alloccat.NEEDS');
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

export interface I18nContextType {
  language: SupportedLang;
  isRTL: boolean;
  locale: LocalePreference;
  setLocale: (p: LocalePreference) => void;
  setLanguage: (l: SupportedLang) => void;
  setCurrency: (c: string) => void;
  setTimezone: (tz: string) => void;
  t: (key: string, fallback?: string) => string;
  formatAmount: (n: number, compact?: boolean) => string;
  currencyCode: string;
  currencySymbol: string;
  formatDate: (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (d: string | Date | null | undefined) => string;
  timezone: string;
  tzLabel: string;
  // Data translators
  tDebtType: (v: string) => string;
  tCategory: (v: string) => string;
  tPriority: (v: string) => string;
  tStatus: (v: string) => string;
  tIncomeType: (v: string) => string;
  tAllocCat: (v: string) => string;
  // Admin
  updateTranslations: (lang: SupportedLang, dict: Record<string,string>) => void;
  translations: Record<SupportedLang, Record<string,string>>;
}

const I18nContext = React.createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocalePreference>(loadLocalePreference);
  const [customT, setCustomT] = useState<Record<SupportedLang, Record<string,string>>>(T);

  const { language, currency, timezone } = locale;
  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === language) ?? SUPPORTED_LANGUAGES[0];
  const currMeta = CURRENCY_LIST.find(c => c.code === currency) ?? CURRENCY_LIST[1];

  // Apply RTL + lang attribute
  useEffect(() => {
    document.documentElement.dir  = langMeta.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, langMeta.rtl]);

  const setLocale = useCallback((p: LocalePreference) => {
    setLocaleState(p);
    saveLocalePreference(p);
  }, []);

  const setLanguage = useCallback((lang: SupportedLang) => {
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === lang) ?? SUPPORTED_LANGUAGES[0];
    setLocale({ language: lang, currency: meta.defaultCurrency,
      country: meta.defaultCountry, timezone: meta.defaultTimezone, isAuto: false });
  }, [setLocale]);

  const setCurrency = useCallback((c: string) => {
    setLocaleState(prev => { const p = { ...prev, currency: c, isAuto: false }; saveLocalePreference(p); return p; });
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setLocaleState(prev => { const p = { ...prev, timezone: tz, isAuto: false }; saveLocalePreference(p); return p; });
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = customT[language] ?? customT['en'];
    return dict[key] ?? customT['en'][key] ?? fallback ?? key;
  }, [language, customT]);

  const formatAmount = useCallback((n: number, compact = false) =>
    formatCurrencyI18n(n, currency, compact), [currency]);

  const formatDate = useCallback((d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
    formatDateTZ(d, timezone, opts), [timezone]);

  const formatDateTime = useCallback((d: string | Date | null | undefined) =>
    formatDateTimeTZ(d, timezone, language), [timezone, language]);

  const updateTranslations = useCallback((lang: SupportedLang, dict: Record<string,string>) => {
    setCustomT(prev => ({ ...prev, [lang]: { ...prev[lang], ...dict } }));
  }, []);

  const value: I18nContextType = {
    language, isRTL: langMeta.rtl, locale, setLocale,
    setLanguage, setCurrency, setTimezone, t,
    formatAmount, currencyCode: currency, currencySymbol: currMeta.symbol,
    formatDate, formatDateTime, timezone,
    tzLabel: getTZOffsetLabel(timezone),
    tDebtType:   v => translateDebtType(v, t),
    tCategory:   v => translateCategory(v, t),
    tPriority:   v => translatePriority(v, t),
    tStatus:     v => translateStatus(v, t),
    tIncomeType: v => translateIncomeType(v, t),
    tAllocCat:   v => translateAllocCategory(v, t),
    updateTranslations,
    translations: customT,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used inside <I18nProvider>');
  return ctx;
};

export const useI18n = useTranslation;
