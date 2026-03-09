/**
 * narrativeService.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Template-based Financial Narrative Engine
 *
 * - 16 scenario templates (3 paragraphs × N scenarios) for all financial states
 * - Templates stored in cloud DB (global_configs key: 'narrative_templates')
 * - Admin can edit template TEXT via /admin/narrative page
 * - Variable placeholders: {{variable}} → injected at render time
 * - Condition matching logic stays in code; only text is DB-managed
 * ────────────────────────────────────────────────────────────────────────────
 */

import { getConfig } from './mockDb';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface NarrativeTemplate {
  id: string;           // unique key, e.g. "p1_critical_deficit"
  paragraph: 1 | 2 | 3; // which paragraph slot
  scenarioKey: string;  // human-readable scenario name
  conditionLabel: string; // shown in admin UI, e.g. "DSR > 40% + Cashflow Negatif"
  conditionDetail: string; // full explanation for admin
  template: string;     // text with {{variable}} placeholders
  isActive: boolean;
  sortOrder: number;
}

export interface NarrativeInput {
  inc: number;
  livingCost: number;
  monthlyDebtObligation: number;
  netCashflow: number;
  dsr: number;
  runway: number;
  healthScore: number;
  totalDebt: number;
  totalLiquid: number;
  activeDebts: any[];
  sfGoal: number;
  sfCurrent: number;
  sfPct: number;
  paidPct: number;
  nearestDebt: any | null;
  monthsToNearest: number;
  lcRatio: number;
  trendDelta: number;
  monthName: string;
  year: number;
}

// ─── NUMBER FORMATTER ─────────────────────────────────────────────────────────

export function fmtRp(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} miliar`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} juta`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000).toLocaleString('id-ID')} ribu`;
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

// ─── DEFAULT TEMPLATES (ALL 16 SCENARIOS) ────────────────────────────────────

export const DEFAULT_NARRATIVE_TEMPLATES: NarrativeTemplate[] = [

  // ══════════════════════════════════════════════════════════════
  // PARAGRAPH 1 — Snapshot Kondisi Bulan Ini
  // ══════════════════════════════════════════════════════════════

  {
    id: 'p1_no_data',
    paragraph: 1,
    scenarioKey: 'Belum Ada Data',
    conditionLabel: 'Income = 0 dan tidak ada hutang',
    conditionDetail: 'Tampil ketika pengguna belum memasukkan data apapun.',
    sortOrder: 1,
    isActive: true,
    template: `Belum ada data keuangan yang cukup untuk dianalisa. Yuk mulai dengan mencatat pendapatan dan pengeluaran rutinmu agar sistem bisa memberikan gambaran kondisi keuangan yang akurat dan personal.`,
  },

  {
    id: 'p1_critical_deficit',
    paragraph: 1,
    scenarioKey: 'Kritis — DSR Tinggi + Defisit',
    conditionLabel: 'DSR > 40% dan cashflow negatif',
    conditionDetail: 'Kondisi paling berbahaya: cicilan menyedot >40% income dan pengeluaran melebihi pemasukan setiap bulan.',
    sortOrder: 2,
    isActive: true,
    template: `Melihat data keuangan kamu di bulan {{monthName}} {{year}}, penghasilan bulananmu sekitar {{inc}}, namun pengeluaran total sudah mencapai {{totalExpense}} — melebihi pemasukan. Dari jumlah itu, cicilan hutang saja sudah menyedot {{monthlyDebtObligation}} ({{dsr}}% dari income), sementara biaya hidup sehari-hari membutuhkan sekitar {{livingCost}}. Akibatnya, setiap bulan kamu mengalami defisit sekitar {{deficit}} — artinya ada lubang yang harus ditutup dari tabungan atau sumber lain yang makin menipis.`,
  },

  {
    id: 'p1_critical_surplus_tiny',
    paragraph: 1,
    scenarioKey: 'Kritis — DSR Tinggi + Surplus Sangat Tipis',
    conditionLabel: 'DSR > 40% dan surplus < 5% income',
    conditionDetail: 'DSR sangat tinggi meski cashflow masih positif, tapi surplus hampir nol sehingga tidak ada ruang gerak.',
    sortOrder: 3,
    isActive: true,
    template: `Di bulan {{monthName}} {{year}}, penghasilan bulananmu sekitar {{inc}}. Pengeluaran harian mencapai {{livingCost}} dan cicilan hutang {{monthlyDebtObligation}} — artinya hampir tidak ada yang tersisa, hanya sekitar {{surplus}} per bulan. Cicilan hutang menyedot {{dsr}}% dari penghasilan, jauh di atas batas sehat 30%. {{sfNote}}`,
  },

  {
    id: 'p1_warning',
    paragraph: 1,
    scenarioKey: 'Waspada — DSR 30–40% atau Dana Darurat Tipis',
    conditionLabel: 'DSR antara 30–40% atau runway < 3 bulan',
    conditionDetail: 'Kondisi mulai memburuk: DSR mendekati batas bahaya atau dana darurat tidak cukup untuk 3 bulan.',
    sortOrder: 4,
    isActive: true,
    template: `Data keuangan bulan {{monthName}} {{year}} menunjukkan penghasilan bulananmu sekitar {{inc}}, dengan pengeluaran hidup sekitar {{livingCost}} dan cicilan hutang {{monthlyDebtObligation}}. {{cashflowNote}} {{runwayNote}}`,
  },

  {
    id: 'p1_healthy',
    paragraph: 1,
    scenarioKey: 'Sehat — DSR Aman + Cashflow Positif',
    conditionLabel: 'Health score >= 60 (DSR aman, cashflow positif)',
    conditionDetail: 'Kondisi keuangan cukup sehat: DSR di bawah 30%, ada surplus bulanan yang layak.',
    sortOrder: 5,
    isActive: true,
    template: `Kabar baik di bulan {{monthName}} {{year}}! Dengan penghasilan {{inc}}, pengeluaran hidupmu {{livingCost}}, dan cicilan hutang {{monthlyDebtObligation}}, kamu masih punya surplus {{surplus}} atau {{surplusPct}}% dari income. {{runwayNote}} {{debtFreeNote}}`,
  },

  {
    id: 'p1_default',
    paragraph: 1,
    scenarioKey: 'Default — Kondisi Umum',
    conditionLabel: 'Kondisi lainnya yang tidak masuk kategori di atas',
    conditionDetail: 'Fallback jika tidak ada skenario spesifik yang cocok.',
    sortOrder: 6,
    isActive: true,
    template: `Melihat data bulan {{monthName}} {{year}}, pendapatanmu sekitar {{inc}} per bulan. Pengeluaran harian sekitar {{livingCost}}{{debtNote}}. {{cashflowSummary}}`,
  },

  // ══════════════════════════════════════════════════════════════
  // PARAGRAPH 2 — Diagnosis Masalah Inti
  // ══════════════════════════════════════════════════════════════

  {
    id: 'p2_debt_free_runway_low',
    paragraph: 2,
    scenarioKey: 'Bebas Hutang + Dana Darurat Sangat Tipis (<3 bln)',
    conditionLabel: 'Tidak ada hutang aktif, runway < 3 bulan',
    conditionDetail: 'Hutang lunas tapi belum ada bantalan darurat — masih rentan terhadap kejadian tak terduga.',
    sortOrder: 7,
    isActive: true,
    template: `Tantangan utama saat ini adalah dana darurat yang masih sangat tipis — hanya cukup {{runway}} bulan pengeluaran. Kondisi ini berbahaya karena satu kejadian tak terduga seperti sakit, PHK, atau kerusakan aset bisa langsung menggoyangkan keuanganmu. {{sfNote}}`,
  },

  {
    id: 'p2_debt_free_runway_mid',
    paragraph: 2,
    scenarioKey: 'Bebas Hutang + Dana Darurat Cukup (3–6 bln)',
    conditionLabel: 'Tidak ada hutang aktif, runway 3–6 bulan',
    conditionDetail: 'Kondisi sudah baik: bebas hutang dan dana darurat tersedia, tapi belum optimal di 6 bulan.',
    sortOrder: 8,
    isActive: true,
    template: `Tidak ada hutang aktif — ini pencapaian yang patut dirayakan. Dana darurat sudah ada di level {{runway}} bulan, tapi masih perlu ditingkatkan ke 6 bulan agar benar-benar aman menghadapi situasi darurat apapun. {{sfNote}}`,
  },

  {
    id: 'p2_debt_free_solid',
    paragraph: 2,
    scenarioKey: 'Bebas Hutang + Dana Darurat Solid (≥6 bln)',
    conditionLabel: 'Tidak ada hutang aktif, runway >= 6 bulan',
    conditionDetail: 'Kondisi ideal: bebas hutang dan dana darurat sudah lebih dari cukup. Siap untuk fase pertumbuhan.',
    sortOrder: 9,
    isActive: true,
    template: `Dengan kondisi bebas hutang dan dana darurat {{runway}} bulan, kamu sudah berada di fondasi keuangan yang solid dan tahan banting. Ini adalah posisi ideal untuk mulai menjalankan strategi pertumbuhan: investasi rutin, passive income, atau percepatan menuju kebebasan finansial. {{sfNote}}`,
  },

  {
    id: 'p2_dsr_critical',
    paragraph: 2,
    scenarioKey: 'Hutang Berat — DSR > 40%',
    conditionLabel: 'Ada hutang aktif, DSR lebih dari 40%',
    conditionDetail: 'Cicilan sangat berat, menyedot lebih dari 40% income. Dana darurat dan tabungan hampir mustahil dibangun.',
    sortOrder: 10,
    isActive: true,
    template: `Yang jadi inti masalahnya adalah beban cicilan yang menyedot {{dsr}}% dari penghasilan kamu — jauh di atas batas sehat 30%. {{nDebtNote}} {{nearestDebtNote}} Selama cicilan sebesar ini masih berjalan, hampir mustahil untuk menabung secara serius atau membangun dana darurat yang layak.`,
  },

  {
    id: 'p2_dsr_warning',
    paragraph: 2,
    scenarioKey: 'Hutang Mulai Mengkhawatirkan — DSR 30–40%',
    conditionLabel: 'Ada hutang aktif, DSR antara 30–40%',
    conditionDetail: 'DSR sudah masuk zona waspada. Masih bisa dikelola tapi perlu tindakan sebelum makin parah.',
    sortOrder: 11,
    isActive: true,
    template: `DSR kamu di angka {{dsr}}% — sudah masuk zona waspada di atas 30%. Ini berarti setiap Rp 100 yang kamu dapat, {{dsr}} rupiah langsung habis untuk cicilan bahkan sebelum dipakai untuk hidup sehari-hari. {{nearestDebtNote}} Prioritas utama saat ini: jangan tambah hutang baru dalam bentuk apapun.`,
  },

  {
    id: 'p2_runway_low_with_debt',
    paragraph: 2,
    scenarioKey: 'DSR Aman tapi Dana Darurat Tipis',
    conditionLabel: 'Ada hutang aktif, DSR <= 30%, runway < 3 bulan',
    conditionDetail: 'DSR masih aman tapi tidak ada bantalan jika terjadi sesuatu. Cicilan bisa terganggu jika income terhenti.',
    sortOrder: 12,
    isActive: true,
    template: `Meski beban cicilan {{dsr}}% masih dalam batas sehat, masalah utamamu adalah dana darurat yang sangat tipis — hanya {{runway}} bulan. Dengan total sisa hutang {{totalDebt}}, kamu perlu memastikan ada bantalan jika terjadi sesuatu yang tidak direncanakan. Satu bulan tanpa penghasilan saja sudah bisa membuatmu kesulitan membayar cicilan tepat waktu dan berujung pada denda atau kredit macet.`,
  },

  {
    id: 'p2_default',
    paragraph: 2,
    scenarioKey: 'Zona Aman — DSR dan Runway Terkendali',
    conditionLabel: 'Ada hutang aktif, DSR <= 30%, runway >= 3 bulan',
    conditionDetail: 'Kondisi terkendali: DSR aman, ada sedikit bantalan darurat. Fokus pada optimasi.',
    sortOrder: 13,
    isActive: true,
    template: `DSR {{dsr}}% masih dalam zona aman, dan cashflow bulanan positif — pertanda pengelolaan keuangan yang cukup disiplin. {{nearestLunas}} {{sfLow}}`,
  },

  // ══════════════════════════════════════════════════════════════
  // PARAGRAPH 3 — Rekomendasi Konkret & Actionable
  // ══════════════════════════════════════════════════════════════

  {
    id: 'p3_critical_deficit',
    paragraph: 3,
    scenarioKey: 'Rekomendasi: Kritis + Defisit',
    conditionLabel: 'DSR > 40% dan cashflow negatif',
    conditionDetail: 'Kondisi paling darurat. Perlu tindakan ekstrem: pangkas pengeluaran agresif atau lepas aset.',
    sortOrder: 14,
    isActive: true,
    template: `Kalau tidak ada perubahan, kondisi ini tidak akan membaik dengan sendirinya. Ada dua jalur yang bisa dipilih: pertama, pangkas pengeluaran hidup secara agresif — dari {{livingCost}} turun ke sekitar {{targetLiving}} dengan me-review pos transport, makan di luar, langganan, dan gaya hidup yang tidak esensial. {{assetNote}} Memilih salah satu jalur ini adalah langkah awal untuk menghentikan kebocoran sebelum kondisi makin sulit diperbaiki.`,
  },

  {
    id: 'p3_critical_surplus',
    paragraph: 3,
    scenarioKey: 'Rekomendasi: Kritis + Surplus Tipis',
    conditionLabel: 'DSR > 40% dan cashflow positif tapi kecil',
    conditionDetail: 'Ada surplus tapi sangat sempit. Fokus freeze hutang baru dan kerahkan surplus untuk pelunasan.',
    sortOrder: 15,
    isActive: true,
    template: `Langkah terpenting sekarang adalah tidak menambah hutang baru dalam bentuk apapun — bahkan cicilan yang tampak "kecil" pun akan langsung menekan cashflow yang sudah sempit ini. {{nearestFocus}} {{emergencyFund}}`,
  },

  {
    id: 'p3_warning_dsr',
    paragraph: 3,
    scenarioKey: 'Rekomendasi: Waspada DSR 30–40%',
    conditionLabel: 'DSR antara 30–40%',
    conditionDetail: 'Masih ada waktu untuk memperbaiki sebelum kritis. Alokasi surplus dengan cermat.',
    sortOrder: 16,
    isActive: true,
    template: `Rekomendasi utama: freeze semua rencana kredit baru dan fokus melunasi hutang yang cicilan per bulannya paling besar terlebih dahulu. {{surplusAllocation}} {{nearestLunasNote}}`,
  },

  {
    id: 'p3_runway_low',
    paragraph: 3,
    scenarioKey: 'Rekomendasi: Dana Darurat Tipis',
    conditionLabel: 'Runway < 3 bulan (DSR masih aman)',
    conditionDetail: 'Prioritas utama adalah membangun bantalan darurat minimal 3 bulan sebelum tujuan lain.',
    sortOrder: 17,
    isActive: true,
    template: `Prioritas nomor satu adalah membangun dana darurat ke minimal 3 bulan pengeluaran (sekitar {{target3months}}). Sisihkan minimal {{monthlyTarget}} per bulan secara konsisten — sebaiknya otomatis transfer ke rekening terpisah di hari yang sama dengan gajian agar tidak tergoda dipakai lebih dulu. {{sfAfterNote}}`,
  },

  {
    id: 'p3_very_healthy',
    paragraph: 3,
    scenarioKey: 'Rekomendasi: Kondisi Prima',
    conditionLabel: 'Health score >= 80',
    conditionDetail: 'Keuangan dalam kondisi sangat sehat. Saatnya fokus pada pertumbuhan dan investasi.',
    sortOrder: 18,
    isActive: true,
    template: `Keuanganmu dalam kondisi prima — saatnya fokus bukan hanya menjaga, tapi juga menumbuhkan aset. {{investNote}} {{sfPrima}}`,
  },

  {
    id: 'p3_stable',
    paragraph: 3,
    scenarioKey: 'Rekomendasi: Cukup Stabil',
    conditionLabel: 'Kondisi umum yang cukup stabil',
    conditionDetail: 'Fallback untuk kondisi yang tidak masuk kategori spesifik di atas.',
    sortOrder: 19,
    isActive: true,
    template: `Kondisimu cukup stabil, tapi masih ada ruang untuk lebih optimal. {{surplusNote}} {{trendWarning}} Review pos pengeluaran setiap awal bulan dan tetapkan target spesifik: misalnya tingkatkan dana darurat ke {{targetRunway}} bulan dalam 3 bulan ke depan.`,
  },
];

// ─── VARIABLE SUBSTITUTION ────────────────────────────────────────────────────

function sub(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────

export function generateNarrativeFromTemplates(
  templates: NarrativeTemplate[],
  p: NarrativeInput
): string[] {
  const {
    inc, livingCost, monthlyDebtObligation, netCashflow, dsr, runway,
    healthScore, totalDebt, totalLiquid, activeDebts, sfGoal, sfCurrent,
    sfPct, paidPct, nearestDebt, monthsToNearest, lcRatio, trendDelta,
    monthName, year,
  } = p;

  // Derived booleans
  const cashOk   = netCashflow > 0;
  const debtFree = activeDebts.length === 0;
  const hasSF    = sfGoal > 0;
  const surplus  = cashOk ? netCashflow : 0;
  const deficit  = cashOk ? 0 : Math.abs(netCashflow);
  const nearestName  = nearestDebt?.name ?? 'hutang terdekat';
  const nearestYrs   = monthsToNearest > 0 ? (monthsToNearest / 12).toFixed(1) : '0';
  const targetLiving = Math.max(inc * 0.40, livingCost * 0.75);

  // ── Build variable map ────────────────────────────────────────
  const vars: Record<string, string> = {
    monthName,
    year: String(year),
    inc:    fmtRp(inc),
    livingCost: fmtRp(livingCost),
    monthlyDebtObligation: fmtRp(monthlyDebtObligation),
    totalExpense: fmtRp(inc - netCashflow),
    netCashflow: fmtRp(netCashflow),
    surplus: fmtRp(surplus),
    deficit: fmtRp(deficit),
    dsr: dsr.toFixed(1),
    dsrInt: dsr.toFixed(0),
    runway: runway.toFixed(1),
    healthScore: healthScore.toFixed(0),
    totalDebt: fmtRp(totalDebt),
    totalLiquid: fmtRp(totalLiquid),
    sfGoal: fmtRp(sfGoal),
    sfCurrent: fmtRp(sfCurrent),
    sfPct: sfPct.toFixed(0),
    paidPct: paidPct.toFixed(1),
    nearestName,
    monthsToNearest: String(monthsToNearest),
    nearestYrs,
    lcRatio: lcRatio.toFixed(0),
    trendDelta: trendDelta.toFixed(0),
    nDebt: String(activeDebts.length),
    targetLiving: fmtRp(targetLiving),
    surplusPct: inc > 0 ? ((surplus / inc) * 100).toFixed(0) : '0',
    monthlyTarget: fmtRp(Math.max(inc * 0.15, 300_000)),
    target3months: fmtRp((livingCost + monthlyDebtObligation) * 3),
    targetRunway: String(Math.ceil(runway + 1)),

    // ── Conditional snippets (injected into templates) ──────────
    sfNote: hasSF
      ? sfCurrent < 1_000_000
        ? `Dana darurat dan sinking fund yang ditarget ${fmtRp(sfGoal)} pun praktis belum bergerak sama sekali.`
        : `Sinking fund yang ditarget ${fmtRp(sfGoal)} baru terisi ${sfPct.toFixed(0)}% — ini yang harus jadi prioritas sekarang.`
      : 'Mulai sisihkan minimal 10–20% income setiap bulan untuk membangun bantalan keuangan.',

    cashflowNote: cashOk
      ? `Masih ada sisa ${fmtRp(surplus)} per bulan, tapi ruang geraknya sempit.`
      : `Sayangnya sudah terjadi defisit ${fmtRp(deficit)} per bulan.`,

    runwayNote: runway < 3
      ? `Dana darurat saat ini hanya cukup untuk ${runway.toFixed(1)} bulan pengeluaran — di bawah standar minimal 3 bulan.`
      : runway < 6
      ? `Dana darurat tersedia untuk ${runway.toFixed(1)} bulan, namun idealnya minimal 6 bulan agar benar-benar aman.`
      : `Dana darurat sudah cukup solid di ${runway.toFixed(1)} bulan — kamu punya bantalan yang baik.`,

    debtFreeNote: debtFree ? 'Dan yang lebih membanggakan — kamu sudah bebas dari hutang! 🎉' : '',

    debtNote: debtFree
      ? ` dan kamu sudah bebas dari cicilan hutang — sebuah pencapaian luar biasa.`
      : `, dengan cicilan hutang ${fmtRp(monthlyDebtObligation)}.`,

    cashflowSummary: cashOk
      ? `Cashflow bulananmu positif, surplus ${fmtRp(surplus)}.`
      : `Namun cashflow masih defisit ${fmtRp(deficit)} per bulan.`,

    nDebtNote: activeDebts.length > 0
      ? `Dari ${activeDebts.length} kontrak hutang aktif dengan total sisa pokok ${fmtRp(totalDebt)},`
      : '',

    nearestDebtNote: nearestDebt
      ? `${nearestName} adalah cicilan yang masih akan berjalan sekitar ${monthsToNearest} bulan lagi${monthsToNearest > 24 ? ` — hampir ${nearestYrs} tahun ke depan` : ''}.`
      : '',

    nearestLunas: nearestDebt && monthsToNearest > 0 && monthsToNearest <= 24
      ? `${nearestName} akan lunas dalam ${monthsToNearest} bulan lagi — momentum bagus untuk langsung alihkan cicilan itu ke tabungan atau investasi.`
      : 'Pertahankan disiplin ini dan mulai tingkatkan alokasi untuk masa depan.',

    sfLow: hasSF && sfPct < 50
      ? `Sinking fund ${fmtRp(sfGoal)} baru ${sfPct.toFixed(0)}% terisi — ini layak dipercepat.`
      : '',

    assetNote: nearestDebt
      ? `Kedua, pertimbangkan untuk melepas aset terberat seperti ${nearestName} jika cicilan dan bunganya tidak sebanding dengan manfaatnya — ini bisa langsung membebaskan ${fmtRp(monthlyDebtObligation)} per bulan untuk dialihkan ke dana darurat dan kehidupan yang lebih sehat.`
      : `Kedua, eksplorasi sumber penghasilan tambahan — bahkan ${fmtRp(inc * 0.2)} per bulan saja sudah bisa mengubah kondisi dari defisit ke surplus.`,

    nearestFocus: nearestDebt && monthsToNearest > 0
      ? `Fokuskan energi pada pelunasan ${nearestName} ${monthsToNearest > 12 ? `dalam ${monthsToNearest} bulan ke depan` : 'secepat mungkin'} dengan memanfaatkan setiap rupiah surplus yang ada.`
      : '',

    emergencyFund: hasSF
      ? `Meski kecil, sisihkan minimal ${fmtRp(Math.max(surplus * 0.5, 100_000))} per bulan ke sinking fund agar ada bantalan darurat.`
      : `Buat pos "dana darurat" meski dimulai dari ${fmtRp(50_000)}–${fmtRp(100_000)} per bulan — lebih baik ada sedikit daripada tidak sama sekali.`,

    surplusAllocation: cashOk && surplus > 500_000
      ? `Surplus ${fmtRp(surplus)} yang ada sebaiknya dialokasikan: ${fmtRp(surplus * 0.5)} untuk percepatan pelunasan hutang, ${fmtRp(surplus * 0.3)} untuk dana darurat, dan ${fmtRp(surplus * 0.2)} untuk sinking fund.`
      : '',

    nearestLunasNote: nearestDebt && monthsToNearest <= 18 && monthsToNearest > 0
      ? `Kabar baiknya, ${nearestName} tinggal ${monthsToNearest} bulan lagi — setelah lunas, segera alihkan cicilan itu ke tabungan dan jangan dibebani kewajiban baru.`
      : 'Konsisten review pengeluaran setiap bulan dan cari celah untuk meningkatkan penghasilan.',

    sfAfterNote: hasSF && sfPct < 30
      ? `Setelah dana darurat aman di 3 bulan, barulah percepat pengisian sinking fund ${fmtRp(sfGoal)}.`
      : 'Setelah dana darurat 3 bulan terpenuhi, tingkatkan ke 6 bulan sambil mulai investasi rutin.',

    investNote: debtFree
      ? `Dengan bebas hutang dan dana darurat solid, sekarang saatnya menggenjot investasi. Alokasikan minimal 20–30% income ke instrumen yang sesuai profil risikomu — reksa dana, saham, atau properti.`
      : `Percepat pelunasan sisa hutang ${fmtRp(totalDebt)} sambil tetap konsisten berinvestasi secara proporsional.`,

    sfPrima: hasSF && sfPct >= 80
      ? `Sinking fund hampir penuh — setelah tercapai, redirect dana itu ke portofolio investasi.`
      : hasSF
      ? `Jangan lupa percepat sinking fund ${fmtRp(sfGoal)} yang baru ${sfPct.toFixed(0)}% terisi.`
      : 'Pertimbangkan membuat sinking fund untuk tujuan besar — liburan, renovasi, atau modal bisnis.',

    surplusNote: cashOk && surplus > 200_000
      ? `Surplus ${fmtRp(surplus)} per bulan jangan dibiarkan diam di rekening biasa — pisahkan ke rekening khusus tabungan atau mulai investasi kecil-kecilan.`
      : '',

    trendWarning: trendDelta > 5
      ? `Pengeluaran bulan ini naik ${trendDelta.toFixed(0)}% dibanding bulan lalu — perlu diwaspadai agar tidak jadi kebiasaan.`
      : '',
  };

  // ── Helper to find template by ID ────────────────────────────
  const find = (id: string): NarrativeTemplate | undefined =>
    templates.find(t => t.id === id && t.isActive);

  // ── Paragraph 1 selection ────────────────────────────────────
  let t1: NarrativeTemplate | undefined;
  if (inc <= 0 && activeDebts.length === 0) {
    t1 = find('p1_no_data');
  } else if (dsr > 40 && !cashOk) {
    t1 = find('p1_critical_deficit');
  } else if (dsr > 40 && cashOk && surplus < inc * 0.05) {
    t1 = find('p1_critical_surplus_tiny');
  } else if (dsr > 30 || runway < 3) {
    t1 = find('p1_warning');
  } else if (healthScore >= 60) {
    t1 = find('p1_healthy');
  } else {
    t1 = find('p1_default');
  }

  // If no data, return only p1
  if (inc <= 0 && activeDebts.length === 0) {
    return t1 ? [sub(t1.template, vars).trim()] : [];
  }

  // ── Paragraph 2 selection ────────────────────────────────────
  let t2: NarrativeTemplate | undefined;
  if (debtFree) {
    if (runway < 3) t2 = find('p2_debt_free_runway_low');
    else if (runway < 6) t2 = find('p2_debt_free_runway_mid');
    else t2 = find('p2_debt_free_solid');
  } else if (dsr > 40) {
    t2 = find('p2_dsr_critical');
  } else if (dsr > 30) {
    t2 = find('p2_dsr_warning');
  } else if (runway < 3) {
    t2 = find('p2_runway_low_with_debt');
  } else {
    t2 = find('p2_default');
  }

  // ── Paragraph 3 selection ────────────────────────────────────
  let t3: NarrativeTemplate | undefined;
  if (dsr > 40 && !cashOk) {
    t3 = find('p3_critical_deficit');
  } else if (dsr > 40 && cashOk) {
    t3 = find('p3_critical_surplus');
  } else if (dsr > 30) {
    t3 = find('p3_warning_dsr');
  } else if (runway < 3) {
    t3 = find('p3_runway_low');
  } else if (healthScore >= 80) {
    t3 = find('p3_very_healthy');
  } else {
    t3 = find('p3_stable');
  }

  return [t1, t2, t3]
    .filter(Boolean)
    .map(t => sub(t!.template, vars).replace(/\s{2,}/g, ' ').trim())
    .filter(s => s.length > 0);
}

// ─── CLOUD FETCH / SAVE ───────────────────────────────────────────────────────

export async function fetchNarrativeTemplates(): Promise<NarrativeTemplate[]> {
  try {
    const config = getConfig();
    const base = (config.backendUrl ?? 'https://api.cosger.com').replace(/\/$/, '');
    const userId = localStorage.getItem('paydone_active_user') ?? '';
    const token  = localStorage.getItem('paydone_session_token') ?? '';
    const res = await fetch(`${base}/api/narrative-templates`, {
      headers: { 'x-user-id': userId, 'x-session-token': token },
    });
    if (!res.ok) return DEFAULT_NARRATIVE_TEMPLATES;
    const data = await res.json();
    const serverTemplates: NarrativeTemplate[] = data.templates ?? [];
    if (serverTemplates.length === 0) return DEFAULT_NARRATIVE_TEMPLATES;
    // Merge: server takes priority, fill new defaults that don't exist yet
    const serverIds = new Set(serverTemplates.map(t => t.id));
    return [
      ...serverTemplates,
      ...DEFAULT_NARRATIVE_TEMPLATES.filter(t => !serverIds.has(t.id)),
    ].sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return DEFAULT_NARRATIVE_TEMPLATES;
  }
}

export async function saveNarrativeTemplates(
  templates: NarrativeTemplate[],
  adminHeaders: Record<string, string>
): Promise<boolean> {
  try {
    const config = getConfig();
    const base = (config.backendUrl ?? 'https://api.cosger.com').replace(/\/$/, '');
    const res = await fetch(`${base}/api/admin/narrative-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ templates }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
