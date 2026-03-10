
/**
 * LandingPage.tsx — Paydone v2 Redesign
 * Bold dark theme | Debt-to-Freedom narrative
 * i18n: auto from browser (en, zh, hi, id) — phase 1
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, ArrowRight, CheckCircle2, ShieldCheck, PieChart, BrainCircuit,
  TrendingUp, AlertTriangle, ChevronRight, Calculator, Zap, Sparkles,
  BarChart3, Calendar, Target, Users, Star, DollarSign,
  ChevronDown, Play, Shield, Banknote, LineChart, Flame,
  Award, Menu, X, ArrowUpRight, RefreshCw,
  CreditCard, BadgePercent, Loader2, Mail, Globe, Check,
  TrendingDown, Lock, Clock, Heart, Lightbulb
} from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { getConfig } from '../services/mockDb';
import { api } from '../services/api';
import { AppConfig, FreemiumPackage } from '../types';
import { useI18n } from '../services/translationService';

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE TRANSLATIONS (en, zh, hi, id, es, fr, ru, ar) — all 8 languages
// Phase 1: en, zh, hi, id | Phase 2: es, fr, ru, ar — self-contained inline
// ─────────────────────────────────────────────────────────────────────────────

type LangCode = 'en' | 'zh' | 'hi' | 'id' | 'es' | 'fr' | 'ru' | 'ar';

const LANG_META: Record<LangCode, { name: string; flag: string; prefix: string[]; rtl?: boolean }> = {
  en: { name: 'English',       flag: '🇺🇸', prefix: ['en'] },
  zh: { name: '中文',          flag: '🇨🇳', prefix: ['zh', 'cn'] },
  hi: { name: 'हिन्दी',        flag: '🇮🇳', prefix: ['hi'] },
  id: { name: 'Indonesia',     flag: '🇮🇩', prefix: ['id'] },
  es: { name: 'Español',       flag: '🇪🇸', prefix: ['es'] },
  fr: { name: 'Français',      flag: '🇫🇷', prefix: ['fr'] },
  ru: { name: 'Русский',       flag: '🇷🇺', prefix: ['ru'] },
  ar: { name: 'العربية',       flag: '🇸🇦', prefix: ['ar'], rtl: true },
};

function detectLang(): LangCode {
  const bl = (navigator?.language || 'en').toLowerCase();
  for (const [code, meta] of Object.entries(LANG_META)) {
    if (meta.prefix.some(p => bl.startsWith(p))) return code as LangCode;
  }
  return 'en';
}

interface LPStrings {
  badge: string;
  hero_h1_a: string;
  hero_h1_b: string;
  typewords: string[];
  hero_sub: string;
  hero_sub_bold1: string;
  hero_sub_bold2: string;
  cta_main: string;
  cta_secondary: string;
  active_users: string;
  nav_simulator: string;
  nav_features: string;
  nav_strategy: string;
  nav_pricing: string;
  nav_faq: string;
  nav_blog: string;
  nav_login: string;
  nav_register: string;
  // Calc
  calc_title: string;
  calc_sub: string;
  calc_debt: string;
  calc_monthly: string;
  calc_rate: string;
  calc_standard: string;
  calc_optimized: string;
  calc_years: string;
  calc_months: string;
  calc_save_interest: string;
  calc_save_time: string;
  calc_cta: string;
  // Stats
  stat_users: string;
  stat_saved: string;
  stat_avg: string;
  stat_rating: string;
  // Features
  feat_title: string;
  feat_sub: string;
  feat_items: { icon: string; title: string; desc: string }[];
  // How it works
  how_title: string;
  how_sub: string;
  how_steps: { title: string; desc: string }[];
  // Strategy
  strat_title: string;
  strat_sub: string;
  strat_snowball_title: string;
  strat_snowball_sub: string;
  strat_snowball_desc: string;
  strat_snowball_pros: string[];
  strat_avalanche_title: string;
  strat_avalanche_sub: string;
  strat_avalanche_desc: string;
  strat_avalanche_pros: string[];
  strat_example_label: string;
  strat_saved_label: string;
  // Testimonials
  test_title: string;
  test_sub: string;
  testimonials: { name: string; role: string; text: string; avatar: number }[];
  // Pricing
  price_title: string;
  price_sub: string;
  price_loading: string;
  price_free_badge: string;
  price_premium_badge: string;
  price_per_month: string;
  price_cta_free: string;
  price_cta_paid: string;
  price_ai_limit: string;
  // FAQ
  faq_title: string;
  faq_sub: string;
  faqs: { q: string; a: string }[];
  // Newsletter
  news_title: string;
  news_sub: string;
  news_placeholder: string;
  news_cta: string;
  news_success: string;
  news_error: string;
  news_no_spam: string;
  // CTA bottom
  final_title: string;
  final_sub: string;
  final_cta: string;
  // Footer
  footer_tagline: string;
  footer_links: string;
  footer_rights: string;
}

const STRINGS: Record<LangCode, LPStrings> = {
  // ─── ENGLISH ───────────────────────────────────────────────────────────────
  en: {
    badge: '🏆 AI-Powered Debt & Budget Manager',
    hero_h1_a: 'Escape Debt.',
    hero_h1_b: '',
    typewords: ['Pay Off Faster.', 'Save More.', 'Live Freely.'],
    hero_sub: 'Not just a calculator. A complete ',
    hero_sub_bold1: 'AI strategy engine',
    hero_sub_bold2: ' that reveals hidden bank costs, optimizes your budget, and gives you the ',
    hero_cta_bridge: 'fastest route to financial freedom.',
    cta_main: 'Start for Free',
    cta_secondary: 'Try Simulator',
    active_users: ' active users',
    nav_simulator: 'Simulator',
    nav_features: 'Features',
    nav_strategy: 'AI Strategy',
    nav_pricing: 'Pricing',
    nav_faq: 'FAQ',
    nav_blog: 'Blog',
    nav_login: 'Sign In',
    nav_register: 'Get Started Free',
    calc_title: 'Debt Freedom Calculator',
    calc_sub: 'See exactly how fast you can become debt-free',
    calc_debt: 'Total Debt',
    calc_monthly: 'Monthly Payment',
    calc_rate: 'Annual Interest Rate',
    calc_standard: 'Without Strategy',
    calc_optimized: 'With Paydone AI',
    calc_years: 'years',
    calc_months: 'months',
    calc_save_interest: 'Interest Saved',
    calc_save_time: 'Time Saved',
    calc_cta: 'Build My Payoff Plan →',
    stat_users: 'Active Users',
    stat_saved: 'Interest Saved',
    stat_avg: 'Avg. Faster Payoff',
    stat_rating: 'User Rating',
    feat_title: 'Every Tool You Need to Win',
    feat_sub: 'From debt tracking to budget planning — everything works together intelligently.',
    feat_items: [
      { icon: 'brain', title: 'AI Debt Strategist', desc: 'AI analyzes your debt profile and automatically selects Snowball (psychological) or Avalanche (mathematical) strategy — whichever gets you free fastest.' },
      { icon: 'pie', title: 'Smart Budget Allocation', desc: 'Auto-categorizes every expense into Needs, Wants, and Debt Obligations with optimal ratios. Your money always knows where to go.' },
      { icon: 'shield', title: 'Financial Freedom Tracker', desc: 'Full future simulator. Calculate retirement assets needed and the path to reach them once you\'re debt-free.' },
      { icon: 'calendar', title: 'Payment Calendar', desc: 'Integrated payment calendar with automatic due-date notifications and per-debt payment tracking with visual timeline.' },
      { icon: 'chart', title: 'Realtime Dashboard', desc: 'Interactive charts with projection graphs, DSR ratio, health score, and payoff progress updating in real-time.' },
      { icon: 'target', title: 'Sinking Fund Manager', desc: 'Manage savings targets visually. Prepare a home down payment, emergency fund, or vacation with smart auto-allocation.' },
    ],
    how_title: 'From Debt to Freedom in 4 Steps',
    how_sub: 'Start in 30 seconds. No credit card. No bank data needed.',
    how_steps: [
      { title: 'Sign Up Free', desc: 'Create your account in 30 seconds. No credit card or sensitive banking data required.' },
      { title: 'Add Your Debts', desc: 'Enter debt details: mortgage, car loan, personal loan, or credit card. AI detects hidden costs automatically.' },
      { title: 'AI Analyzes', desc: 'The system analyzes and recommends the fastest payoff strategy tailored to your financial profile.' },
      { title: 'Execute & Monitor', desc: 'Follow your daily roadmap. Track progress, get notifications, and watch your debt shrink every day.' },
    ],
    strat_title: 'Two Strategies. One Smart AI.',
    strat_sub: 'Paydone AI selects the optimal strategy based on your real data — not guesswork.',
    strat_snowball_title: 'Snowball Method',
    strat_snowball_sub: 'Psychological Momentum',
    strat_snowball_desc: 'Pay off the smallest debt first. Each payoff creates a psychological win that fuels discipline to tackle the next one.',
    strat_snowball_pros: ['Quick wins keep you motivated', 'Reduces number of debts fast', 'Best for emotional discipline'],
    strat_avalanche_title: 'Avalanche Method',
    strat_avalanche_sub: 'Mathematical Optimization',
    strat_avalanche_desc: 'Pay off the highest-interest debt first. Minimizes total interest paid and gets you debt-free faster in pure financial terms.',
    strat_avalanche_pros: ['Maximum interest savings', 'Mathematically optimal path', 'Best for high-rate credit cards'],
    strat_example_label: 'Example Payoff Order',
    strat_saved_label: 'Est. Interest Saved',
    test_title: 'Real People. Real Results.',
    test_sub: 'Join thousands who\'ve already started their journey to financial freedom.',
    testimonials: [
      { name: 'David Chen', role: 'Software Engineer, San Francisco', text: 'I was paying random minimums everywhere. Paydone showed me I could save $8,400 in mortgage interest using Avalanche. Life-changing.', avatar: 101 },
      { name: 'Priya Sharma', role: 'Freelancer, Mumbai', text: 'The budget allocation feature made me finally disciplined. My salary auto-splits into needs, wants, and debt every month. Stress dropped massively.', avatar: 202 },
      { name: 'Wei Zhang', role: 'Small Business Owner, Shanghai', text: 'The real-cost simulator was eye-opening. My "20% down payment" was actually 32% after all the hidden fees. Wish I knew earlier.', avatar: 303 },
      { name: 'Sarah Mitchell', role: 'Doctor, Chicago', text: 'The payment calendar is brilliant. I used to forget due dates, now everything is scheduled perfectly. The auto-marking feature is incredible.', avatar: 404 },
      { name: 'James Park', role: 'Government Employee, Seoul', text: 'Family mode is a game-changer. My wife and I finally have the same visibility into our finances. No more hiding anything from each other.', avatar: 505 },
      { name: 'Ana Rivera', role: 'Content Creator, Mexico City', text: 'As a freelancer with irregular income, multi-income tracking and smart allocation are lifesavers. Finally saving consistently every month.', avatar: 606 },
    ],
    price_title: 'Start Free. Upgrade When Ready.',
    price_sub: 'All core features free forever. Upgrade for advanced AI and family features.',
    price_loading: 'Loading plans...',
    price_free_badge: 'Most Popular',
    price_premium_badge: 'Best Value',
    price_per_month: '/month',
    price_cta_free: 'Get Started Free',
    price_cta_paid: 'Start 7-Day Trial',
    price_ai_limit: 'AI queries/day',
    faq_title: 'Common Questions',
    faq_sub: 'Everything you need to know about getting debt-free with Paydone.',
    faqs: [
      { q: 'Is Paydone free?', a: 'Yes, Paydone is completely free for personal use. Core features like debt tracking, the simulator, and AI strategist are accessible at no cost. Premium plans offer advanced AI and multi-device sync.' },
      { q: 'Is my financial data safe?', a: 'Absolutely. Your data is end-to-end encrypted and stored locally first. Cloud sync is optional and uses industry-standard encryption. We never sell user data.' },
      { q: 'What types of debt can I track?', a: 'All debt types: mortgage, car loan, personal loan, credit cards, student loans, online loans, and personal debts. Each has appropriate interest calculations.' },
      { q: 'How does AI Strategist work?', a: 'Our AI analyzes your total debt, interest rates, remaining tenure, and income profile. It then recommends the optimal payoff order — Snowball or Avalanche — with projected time and savings.' },
      { q: 'Can it be used for a family?', a: 'Yes! Family Mode lets you manage finances together with your spouse or family members. Each person has a separate account but can view the overall family financial picture.' },
      { q: 'Do I need an internet connection?', a: 'Not always. Paydone works offline-first. Data is stored locally and syncs automatically when connected. You can input expenses and view your dashboard without internet.' },
    ],
    news_title: 'Get Smarter About Money',
    news_sub: 'Join our newsletter for debt payoff strategies, budgeting tips, and feature updates.',
    news_placeholder: 'Enter your email address',
    news_cta: 'Subscribe',
    news_success: '🎉 You\'re subscribed! Check your inbox.',
    news_error: 'Please enter a valid email.',
    news_no_spam: 'No spam. Unsubscribe anytime.',
    final_title: 'Your Debt-Free Future Starts Today.',
    final_sub: 'Don\'t let compound interest steal your future. Join 2,847+ users already on the path to financial freedom.',
    final_cta: 'Start My Journey for Free →',
    footer_tagline: 'AI-powered debt freedom & budget manager.',
    footer_links: 'Privacy · Terms · Blog · Support',
    footer_rights: '© 2025 Paydone. All rights reserved.',
  },

  // ─── CHINESE (SIMPLIFIED) ─────────────────────────────────────────────────
  zh: {
    badge: '🏆 AI驱动的债务与预算管理平台',
    hero_h1_a: '摆脱债务。',
    hero_h1_b: '',
    typewords: ['更快还清。', '储蓄更多。', '自由生活。'],
    hero_sub: '不只是计算器，而是一套完整的',
    hero_sub_bold1: 'AI策略引擎',
    hero_sub_bold2: '——揭露银行隐性费用，优化预算分配，为您规划',
    hero_cta_bridge: '最快的财务自由之路。',
    cta_main: '免费开始',
    cta_secondary: '试用模拟器',
    active_users: ' 位活跃用户',
    nav_simulator: '模拟器',
    nav_features: '功能',
    nav_strategy: 'AI策略',
    nav_pricing: '定价',
    nav_faq: '常见问题',
    nav_blog: '博客',
    nav_login: '登录',
    nav_register: '免费注册',
    calc_title: '债务自由计算器',
    calc_sub: '看看您能多快实现无债一身轻',
    calc_debt: '总债务',
    calc_monthly: '月还款额',
    calc_rate: '年利率',
    calc_standard: '无策略方案',
    calc_optimized: '使用Paydone AI',
    calc_years: '年',
    calc_months: '个月',
    calc_save_interest: '节省利息',
    calc_save_time: '节省时间',
    calc_cta: '制定我的还款计划 →',
    stat_users: '活跃用户',
    stat_saved: '已节省利息',
    stat_avg: '平均提前还清',
    stat_rating: '用户评分',
    feat_title: '赢得财务战争的全套工具',
    feat_sub: '从债务追踪到预算规划——所有功能智能协作。',
    feat_items: [
      { icon: 'brain', title: 'AI债务策略师', desc: 'AI分析您的债务状况，自动选择雪球法（心理激励）或雪崩法（数学最优）——让您以最快速度实现财务自由。' },
      { icon: 'pie', title: '智能预算分配', desc: '自动将每笔支出分类为需求、欲望和债务偿还，比例最优。您的钱永远知道该去哪里。' },
      { icon: 'shield', title: '财务自由追踪', desc: '完整的未来模拟器。计算退休所需资产，以及还清债务后实现目标的路径。' },
      { icon: 'calendar', title: '还款日历', desc: '集成还款日历，自动到期提醒，以及每笔债务的可视化时间轴追踪。' },
      { icon: 'chart', title: '实时仪表盘', desc: '交互式图表，包含预测图、DSR比率、健康评分和实时更新的还款进度。' },
      { icon: 'target', title: '沉没基金管理', desc: '用可视化目标管理储蓄。为首付、应急基金或假期做好准备，智能自动分配。' },
    ],
    how_title: '四步从债务走向自由',
    how_sub: '30秒内开始。无需信用卡。无需银行数据。',
    how_steps: [
      { title: '免费注册', desc: '30秒内创建账户。无需信用卡或敏感银行信息。' },
      { title: '录入债务', desc: '输入债务详情：房贷、车贷、个人贷款或信用卡。AI自动检测隐性费用。' },
      { title: 'AI分析', desc: '系统分析并推荐最适合您财务状况的最快还款策略。' },
      { title: '执行与监控', desc: '遵循每日路线图。跟踪进度、接收通知，看着债务每天减少。' },
    ],
    strat_title: '两种策略。一个智慧AI。',
    strat_sub: 'Paydone AI基于您的真实数据选择最优策略——不靠猜测。',
    strat_snowball_title: '雪球法',
    strat_snowball_sub: '心理动力驱动',
    strat_snowball_desc: '优先还清最小债务。每次还清都带来心理成就感，激励您继续攻克下一个。',
    strat_snowball_pros: ['快速胜利保持动力', '迅速减少债务数量', '适合需要情绪激励的人'],
    strat_avalanche_title: '雪崩法',
    strat_avalanche_sub: '数学最优化',
    strat_avalanche_desc: '优先还清利率最高的债务。最大限度减少总利息支出，在纯财务层面最快实现还清。',
    strat_avalanche_pros: ['最大限度节省利息', '数学上最优路径', '最适合高利率信用卡'],
    strat_example_label: '还款顺序示例',
    strat_saved_label: '预计节省利息',
    test_title: '真实用户。真实成果。',
    test_sub: '加入数千位已经开始财务自由之旅的用户。',
    testimonials: [
      { name: '张伟明', role: '软件工程师，北京', text: '以前随便还最低额。Paydone让我发现用雪崩法可以节省近5万元房贷利息。改变了我的人生。', avatar: 101 },
      { name: '李小燕', role: '自由职业者，上海', text: '预算分配功能终于让我变得自律。工资自动分配到需求、欲望和债务。压力减少了太多。', avatar: 202 },
      { name: '王建国', role: '小企业主，深圳', text: '真实成本模拟器大开眼界。我的"20%首付"实际上加上所有隐性费用变成了32%。早知道就好了。', avatar: 303 },
      { name: '刘芳华', role: '医生，广州', text: '还款日历非常实用。以前总忘还款日，现在全部安排得井井有条。自动标记功能太棒了。', avatar: 404 },
      { name: '陈志远', role: '公务员，成都', text: '家庭模式改变了一切。我和妻子终于对家庭财务有了同等了解。不再有任何财务秘密。', avatar: 505 },
      { name: '吴美玲', role: '内容创作者，杭州', text: '作为收入不固定的自由职业者，多收入追踪和智能分配是救星。终于每个月都能持续储蓄。', avatar: 606 },
    ],
    price_title: '免费开始。准备好再升级。',
    price_sub: '所有核心功能永久免费。升级获取高级AI和家庭功能。',
    price_loading: '加载方案中...',
    price_free_badge: '最受欢迎',
    price_premium_badge: '最佳性价比',
    price_per_month: '/月',
    price_cta_free: '免费开始',
    price_cta_paid: '开始7天试用',
    price_ai_limit: 'AI查询/天',
    faq_title: '常见问题',
    faq_sub: '关于使用Paydone实现无债一身轻的一切问题。',
    faqs: [
      { q: 'Paydone免费吗？', a: '是的，Paydone个人使用完全免费。债务追踪、模拟器和AI策略师等核心功能无需付费。高级套餐提供进阶AI和多设备同步。' },
      { q: '我的财务数据安全吗？', a: '绝对安全。您的数据端对端加密，优先本地存储。云同步为可选项，使用行业标准加密。我们从不出售用户数据。' },
      { q: '可以追踪哪些类型的债务？', a: '所有债务类型：房贷、车贷、个人贷款、信用卡、学生贷款、网贷和私人债务。每种都有对应的利息计算。' },
      { q: 'AI策略师如何工作？', a: '我们的AI分析您的总债务、利率、剩余期限和收入状况，然后推荐最优还款顺序——雪球法或雪崩法——并附带时间和节省预测。' },
      { q: '可以用于家庭吗？', a: '可以！家庭模式让您与配偶或家庭成员共同管理财务。每人有独立账户，但可以查看整体家庭财务状况。' },
      { q: '需要网络连接吗？', a: '不一定。Paydone支持离线优先工作。数据本地存储，联网时自动同步。无网络也可输入支出和查看仪表盘。' },
    ],
    news_title: '让财务更聪明',
    news_sub: '订阅我们的通讯，获取还债策略、预算技巧和功能更新。',
    news_placeholder: '输入您的邮箱地址',
    news_cta: '订阅',
    news_success: '🎉 订阅成功！请查看您的邮箱。',
    news_error: '请输入有效的邮箱地址。',
    news_no_spam: '无垃圾邮件。随时退订。',
    final_title: '无债未来，从今天开始。',
    final_sub: '别让复利偷走您的未来。加入2,847+用户，一起走上财务自由之路。',
    final_cta: '免费开始我的旅程 →',
    footer_tagline: 'AI驱动的债务自由与预算管理。',
    footer_links: '隐私 · 条款 · 博客 · 支持',
    footer_rights: '© 2025 Paydone. 保留所有权利。',
  },

  // ─── HINDI ───────────────────────────────────────────────────────────────
  hi: {
    badge: '🏆 AI-संचालित ऋण और बजट प्रबंधक',
    hero_h1_a: 'क़र्ज़ से मुक्ति।',
    hero_h1_b: '',
    typewords: ['जल्दी चुकाएं।', 'अधिक बचाएं।', 'स्वतंत्र जिएं।'],
    hero_sub: 'सिर्फ़ कैलकुलेटर नहीं। एक पूरा ',
    hero_sub_bold1: 'AI रणनीति इंजन',
    hero_sub_bold2: ' जो बैंक की छुपी फ़ीस उजागर करता है, बजट को ऑप्टिमाइज़ करता है और आपको देता है ',
    hero_cta_bridge: 'वित्तीय स्वतंत्रता का सबसे तेज़ रास्ता।',
    cta_main: 'मुफ़्त शुरू करें',
    cta_secondary: 'सिम्युलेटर आज़माएं',
    active_users: ' सक्रिय उपयोगकर्ता',
    nav_simulator: 'सिम्युलेटर',
    nav_features: 'फ़ीचर',
    nav_strategy: 'AI रणनीति',
    nav_pricing: 'मूल्य',
    nav_faq: 'सवाल-जवाब',
    nav_blog: 'ब्लॉग',
    nav_login: 'लॉगिन',
    nav_register: 'मुफ़्त रजिस्टर',
    calc_title: 'ऋण मुक्ति कैलकुलेटर',
    calc_sub: 'देखें आप कितनी जल्दी क़र्ज़मुक्त हो सकते हैं',
    calc_debt: 'कुल ऋण',
    calc_monthly: 'मासिक भुगतान',
    calc_rate: 'वार्षिक ब्याज दर',
    calc_standard: 'बिना रणनीति के',
    calc_optimized: 'Paydone AI के साथ',
    calc_years: 'साल',
    calc_months: 'महीने',
    calc_save_interest: 'ब्याज की बचत',
    calc_save_time: 'समय की बचत',
    calc_cta: 'मेरी चुकौती योजना बनाएं →',
    stat_users: 'सक्रिय उपयोगकर्ता',
    stat_saved: 'ब्याज बचाई',
    stat_avg: 'औसत जल्दी चुकौती',
    stat_rating: 'यूज़र रेटिंग',
    feat_title: 'जीतने के लिए हर ज़रूरी टूल',
    feat_sub: 'ऋण ट्रैकिंग से बजट योजना तक — सब कुछ मिलकर काम करता है।',
    feat_items: [
      { icon: 'brain', title: 'AI ऋण रणनीतिकार', desc: 'AI आपकी ऋण स्थिति का विश्लेषण करता है और स्वचालित रूप से स्नोबॉल (मनोवैज्ञानिक) या अवलांच (गणितीय) रणनीति चुनता है।' },
      { icon: 'pie', title: 'स्मार्ट बजट आवंटन', desc: 'हर खर्च को ज़रूरतों, इच्छाओं और ऋण भुगतान में स्वतः विभाजित करता है। आपका पैसा हमेशा जानता है कहाँ जाना है।' },
      { icon: 'shield', title: 'वित्तीय स्वतंत्रता ट्रैकर', desc: 'पूर्ण भविष्य सिम्युलेटर। ऋण चुकाने के बाद सेवानिवृत्ति संपत्ति और उसे पाने का रास्ता जानें।' },
      { icon: 'calendar', title: 'भुगतान कैलेंडर', desc: 'एकीकृत भुगतान कैलेंडर, स्वचालित देय तिथि अधिसूचना और विज़ुअल टाइमलाइन के साथ प्रत्येक ऋण ट्रैकिंग।' },
      { icon: 'chart', title: 'रीयलटाइम डैशबोर्ड', desc: 'इंटरैक्टिव चार्ट के साथ प्रोजेक्शन ग्राफ, DSR अनुपात, स्वास्थ्य स्कोर और रियल-टाइम अपडेट।' },
      { icon: 'target', title: 'सिंकिंग फंड मैनेजर', desc: 'बचत लक्ष्यों को विज़ुअली प्रबंधित करें। होम डाउन पेमेंट, इमर्जेंसी फंड या छुट्टी के लिए स्मार्ट ऑटो-आवंटन।' },
    ],
    how_title: '4 चरणों में ऋण से स्वतंत्रता',
    how_sub: '30 सेकंड में शुरू करें। कोई क्रेडिट कार्ड नहीं। कोई बैंक डेटा नहीं।',
    how_steps: [
      { title: 'मुफ़्त साइन अप', desc: '30 सेकंड में अकाउंट बनाएं। क्रेडिट कार्ड या संवेदनशील बैंकिंग जानकारी की ज़रूरत नहीं।' },
      { title: 'ऋण जोड़ें', desc: 'ऋण विवरण दर्ज करें: होम लोन, कार लोन, पर्सनल लोन, या क्रेडिट कार्ड। AI छुपे खर्च स्वतः पहचानता है।' },
      { title: 'AI विश्लेषण', desc: 'सिस्टम आपकी वित्तीय प्रोफ़ाइल के अनुसार सबसे तेज़ चुकौती रणनीति विश्लेषित करता और सुझाता है।' },
      { title: 'कार्यान्वित करें और निगरानी रखें', desc: 'दैनिक रोडमैप का पालन करें। प्रगति ट्रैक करें, सूचनाएं पाएं और हर दिन ऋण कम होते देखें।' },
    ],
    strat_title: 'दो रणनीतियां। एक स्मार्ट AI।',
    strat_sub: 'Paydone AI आपके वास्तविक डेटा के आधार पर सर्वोत्तम रणनीति चुनता है।',
    strat_snowball_title: 'स्नोबॉल विधि',
    strat_snowball_sub: 'मनोवैज्ञानिक प्रेरणा',
    strat_snowball_desc: 'सबसे छोटा ऋण पहले चुकाएं। हर जीत से आत्मविश्वास बढ़ता है जो अगले ऋण से लड़ने की प्रेरणा देती है।',
    strat_snowball_pros: ['जल्दी जीत से प्रेरणा मिलती है', 'ऋणों की संख्या तेज़ी से घटती है', 'भावनात्मक अनुशासन के लिए बेस्ट'],
    strat_avalanche_title: 'अवलांच विधि',
    strat_avalanche_sub: 'गणितीय अनुकूलन',
    strat_avalanche_desc: 'सबसे ज़्यादा ब्याज वाला ऋण पहले चुकाएं। कुल ब्याज भुगतान को कम करता है और वित्तीय रूप से सबसे तेज़ मुक्ति।',
    strat_avalanche_pros: ['ब्याज की अधिकतम बचत', 'गणितीय रूप से सर्वोत्तम रास्ता', 'हाई-रेट क्रेडिट कार्ड के लिए बेस्ट'],
    strat_example_label: 'उदाहरण चुकौती क्रम',
    strat_saved_label: 'अनुमानित ब्याज बचत',
    test_title: 'वास्तविक लोग। वास्तविक परिणाम।',
    test_sub: 'हज़ारों लोगों से जुड़ें जिन्होंने वित्तीय स्वतंत्रता की यात्रा शुरू कर दी है।',
    testimonials: [
      { name: 'राहुल वर्मा', role: 'सॉफ्टवेयर इंजीनियर, बेंगलुरु', text: 'पहले बेतरतीब न्यूनतम राशि भरता था। Paydone ने दिखाया कि अवलांच से ₹6.2 लाख होम लोन ब्याज बचाया जा सकता है।', avatar: 101 },
      { name: 'प्रिया मेहता', role: 'फ्रीलांसर, मुंबई', text: 'बजट आवंटन फ़ीचर ने मुझे अनुशासित बनाया। वेतन अपने आप जरूरत, इच्छा और EMI में बंट जाता है। तनाव बहुत कम हो गया।', avatar: 202 },
      { name: 'अमित शर्मा', role: 'लघु व्यवसाय, दिल्ली', text: 'रियल कॉस्ट सिम्युलेटर ने आंखें खोलीं। मेरा "20% डाउन पेमेंट" सारी छुपी फ़ीस के बाद 32% था। काश पहले पता होता।', avatar: 303 },
      { name: 'डॉ. नेहा सिंह', role: 'डॉक्टर, पुणे', text: 'पेमेंट कैलेंडर बेमिसाल है। पहले ड्यू डेट भूल जाती थी, अब सब शेड्यूल है। ऑटो-मार्किंग फ़ीचर कमाल का है।', avatar: 404 },
      { name: 'विकास पाण्डेय', role: 'सरकारी कर्मचारी, लखनऊ', text: 'फैमिली मोड गेम-चेंजर है। पत्नी और मैं अब परिवार की वित्तीय स्थिति एक साथ देखते हैं। कोई छुपाव नहीं।', avatar: 505 },
      { name: 'कविता रेड्डी', role: 'कंटेंट क्रिएटर, हैदराबाद', text: 'अनियमित आय के फ्रीलांसर के रूप में, मल्टी-इनकम ट्रैकिंग और स्मार्ट एलोकेशन जीवनरक्षक हैं। अब हर महीने बचत होती है।', avatar: 606 },
    ],
    price_title: 'मुफ़्त शुरू करें। तैयार होने पर अपग्रेड।',
    price_sub: 'सभी मुख्य फ़ीचर हमेशा के लिए मुफ़्त। एडवांस AI के लिए अपग्रेड करें।',
    price_loading: 'प्लान लोड हो रहे हैं...',
    price_free_badge: 'सबसे लोकप्रिय',
    price_premium_badge: 'सबसे किफायती',
    price_per_month: '/माह',
    price_cta_free: 'मुफ़्त शुरू करें',
    price_cta_paid: '7-दिन ट्रायल शुरू करें',
    price_ai_limit: 'AI क्वेरी/दिन',
    faq_title: 'सामान्य प्रश्न',
    faq_sub: 'Paydone से क़र्ज़मुक्त होने के बारे में जानने योग्य सब कुछ।',
    faqs: [
      { q: 'क्या Paydone मुफ़्त है?', a: 'हाँ, Paydone व्यक्तिगत उपयोग के लिए पूरी तरह मुफ़्त है। ऋण ट्रैकिंग, सिम्युलेटर और AI रणनीतिकार जैसी मुख्य सुविधाएं बिना किसी शुल्क के उपलब्ध हैं।' },
      { q: 'क्या मेरा वित्तीय डेटा सुरक्षित है?', a: 'बिल्कुल। आपका डेटा एंड-टू-एंड एन्क्रिप्टेड है और पहले स्थानीय रूप से संग्रहीत होता है। क्लाउड सिंक वैकल्पिक है। हम कभी उपयोगकर्ता डेटा नहीं बेचते।' },
      { q: 'कौन से ऋण ट्रैक कर सकते हैं?', a: 'सभी प्रकार के ऋण: होम लोन, कार लोन, पर्सनल लोन, क्रेडिट कार्ड, स्टूडेंट लोन, और व्यक्तिगत ऋण। प्रत्येक के लिए उचित ब्याज गणना।' },
      { q: 'AI रणनीतिकार कैसे काम करता है?', a: 'हमारा AI आपका कुल ऋण, ब्याज दरें, शेष अवधि और आय प्रोफ़ाइल विश्लेषित करता है, फिर स्नोबॉल या अवलांच की सर्वोत्तम सिफारिश करता है।' },
      { q: 'क्या परिवार के लिए उपयोग किया जा सकता है?', a: 'हाँ! फैमिली मोड आपको जीवनसाथी या परिवार के सदस्यों के साथ मिलकर वित्त प्रबंधित करने देता है।' },
      { q: 'क्या इंटरनेट कनेक्शन चाहिए?', a: 'हमेशा नहीं। Paydone ऑफलाइन-फर्स्ट काम करता है। डेटा स्थानीय रूप से संग्रहीत होता है और कनेक्ट होने पर स्वचालित सिंक होता है।' },
    ],
    news_title: 'पैसे के बारे में समझदार बनें',
    news_sub: 'ऋण चुकौती रणनीतियों, बजट टिप्स और फ़ीचर अपडेट के लिए न्यूज़लेटर जॉइन करें।',
    news_placeholder: 'अपना ईमेल पता दर्ज करें',
    news_cta: 'सब्सक्राइब करें',
    news_success: '🎉 सब्सक्रिप्शन हो गई! अपना इनबॉक्स देखें।',
    news_error: 'कृपया वैध ईमेल पता दर्ज करें।',
    news_no_spam: 'कोई स्पैम नहीं। कभी भी अनसब्सक्राइब करें।',
    final_title: 'आपका क़र्ज़मुक्त भविष्य आज से शुरू होता है।',
    final_sub: 'चक्रवृद्धि ब्याज को आपका भविष्य न चुराने दें। 2,847+ उपयोगकर्ताओं से जुड़ें जो पहले से वित्तीय स्वतंत्रता की राह पर हैं।',
    final_cta: 'मुफ़्त अपनी यात्रा शुरू करें →',
    footer_tagline: 'AI-संचालित ऋण मुक्ति और बजट प्रबंधन।',
    footer_links: 'गोपनीयता · नियम · ब्लॉग · सहायता',
    footer_rights: '© 2025 Paydone. सर्वाधिकार सुरक्षित।',
  },

  // ─── INDONESIAN ──────────────────────────────────────────────────────────
  id: {
    badge: '🏆 Manajer Hutang & Budget Berbasis AI',
    hero_h1_a: 'Terbebas dari Hutang.',
    hero_h1_b: '',
    typewords: ['Lebih Cepat Lunas.', 'Hemat Lebih Banyak.', 'Hidup Bebas.'],
    hero_sub: 'Bukan sekadar kalkulator. Ini adalah ',
    hero_sub_bold1: 'mesin strategi berbasis AI',
    hero_sub_bold2: ' yang mengungkap biaya terselubung bank, mengoptimalkan budget, dan memberi Anda ',
    hero_cta_bridge: 'rute tercepat menuju kebebasan finansial.',
    cta_main: 'Mulai Gratis',
    cta_secondary: 'Coba Simulator',
    active_users: ' pengguna aktif',
    nav_simulator: 'Simulator',
    nav_features: 'Fitur',
    nav_strategy: 'Strategi AI',
    nav_pricing: 'Harga',
    nav_faq: 'FAQ',
    nav_blog: 'Blog',
    nav_login: 'Masuk',
    nav_register: 'Daftar Gratis',
    calc_title: 'Kalkulator Kebebasan Hutang',
    calc_sub: 'Lihat seberapa cepat Anda bisa bebas dari hutang',
    calc_debt: 'Total Hutang',
    calc_monthly: 'Cicilan Bulanan',
    calc_rate: 'Bunga per Tahun (%)',
    calc_standard: 'Tanpa Strategi',
    calc_optimized: 'Dengan Paydone AI',
    calc_years: 'tahun',
    calc_months: 'bulan',
    calc_save_interest: 'Hemat Bunga',
    calc_save_time: 'Hemat Waktu',
    calc_cta: 'Buat Rencana Pelunasan →',
    stat_users: 'Pengguna Aktif',
    stat_saved: 'Bunga Tersimpan',
    stat_avg: 'Rata-rata Lebih Cepat',
    stat_rating: 'Rating Pengguna',
    feat_title: 'Semua Alat untuk Menang',
    feat_sub: 'Dari tracking hutang hingga perencanaan budget — semua bekerja bersama secara cerdas.',
    feat_items: [
      { icon: 'brain', title: 'AI Debt Strategist', desc: 'AI menganalisa profil hutang Anda dan otomatis memilih strategi Snowball (psikologis) atau Avalanche (matematis) — mana yang paling cepat membuat Anda bebas.' },
      { icon: 'pie', title: 'Smart Budget Allocation', desc: 'Otomatis memilah setiap pengeluaran ke Kebutuhan, Keinginan, dan Kewajiban Hutang dengan rasio optimal. Uang Anda selalu tahu ke mana harus pergi.' },
      { icon: 'shield', title: 'Financial Freedom Tracker', desc: 'Simulator masa depan lengkap. Hitung aset pensiun yang dibutuhkan dan jalur mencapainya setelah semua hutang lunas.' },
      { icon: 'calendar', title: 'Payment Calendar', desc: 'Kalender cicilan terintegrasi, notifikasi jatuh tempo otomatis, dan tracking pembayaran per hutang dengan visual timeline.' },
      { icon: 'chart', title: 'Realtime Dashboard', desc: 'Grafik proyeksi, DSR ratio, health score, dan progress pelunasan yang update secara real-time.' },
      { icon: 'target', title: 'Sinking Fund Manager', desc: 'Kelola dana cadangan dengan target visual. Siapkan DP rumah, dana darurat, atau liburan dengan auto-allocation cerdas.' },
    ],
    how_title: 'Dari Hutang ke Bebas dalam 4 Langkah',
    how_sub: 'Mulai dalam 30 detik. Tanpa kartu kredit. Tanpa data perbankan sensitif.',
    how_steps: [
      { title: 'Daftar Gratis', desc: 'Buat akun dalam 30 detik. Tidak perlu kartu kredit atau data sensitif perbankan.' },
      { title: 'Input Data Hutang', desc: 'Masukkan detail hutang: KPR, KKB, KTA, atau Kartu Kredit. AI akan mendeteksi biaya tersembunyi.' },
      { title: 'AI Analisis', desc: 'Sistem menganalisa dan merekomendasikan strategi pelunasan tercepat sesuai profil keuangan Anda.' },
      { title: 'Eksekusi & Monitor', desc: 'Ikuti roadmap harian. Track progress, terima notifikasi, dan lihat hutang berkurang setiap hari.' },
    ],
    strat_title: 'Dua Strategi. Satu AI Cerdas.',
    strat_sub: 'Paydone AI memilih strategi optimal berdasarkan data riil Anda — bukan tebak-tebakan.',
    strat_snowball_title: 'Metode Snowball',
    strat_snowball_sub: 'Momentum Psikologis',
    strat_snowball_desc: 'Lunasi hutang terkecil terlebih dahulu. Setiap pelunasan menciptakan kemenangan psikologis yang membakar semangat untuk terus maju.',
    strat_snowball_pros: ['Kemenangan cepat menjaga motivasi', 'Jumlah hutang berkurang pesat', 'Terbaik untuk disiplin emosional'],
    strat_avalanche_title: 'Metode Avalanche',
    strat_avalanche_sub: 'Optimasi Matematis',
    strat_avalanche_desc: 'Lunasi hutang berbunga tertinggi terlebih dahulu. Meminimalkan total bunga yang dibayar dan paling cepat secara finansial.',
    strat_avalanche_pros: ['Hemat bunga maksimal', 'Jalur optimal secara matematis', 'Terbaik untuk kartu kredit berbunga tinggi'],
    strat_example_label: 'Contoh Urutan Pelunasan',
    strat_saved_label: 'Est. Hemat Bunga',
    test_title: 'Orang Nyata. Hasil Nyata.',
    test_sub: 'Bergabunglah dengan ribuan orang yang sudah memulai perjalanan menuju kebebasan finansial.',
    testimonials: [
      { name: 'Budi Santoso', role: 'Karyawan Swasta, Jakarta', text: 'Dulu bayar cicilan asal-asalan. Setelah pakai Paydone, saya sadar bisa hemat Rp 47 juta bunga KPR dengan strategi Avalanche!', avatar: 100 },
      { name: 'Sari Dewi', role: 'Freelancer, Bandung', text: 'Fitur allocation bikin saya disiplin. Gaji langsung ter-split ke kebutuhan, keinginan, dan cicilan. Stress berkurang drastis.', avatar: 200 },
      { name: 'Andi Pratama', role: 'Pengusaha UMKM, Surabaya', text: 'Simulator realita-nya eye-opening. DP rumah bukan cuma 20%, ada biaya tersembunyi hampir Rp 20 juta yang bank tidak bilang!', avatar: 300 },
      { name: 'Rina Kusuma', role: 'Dokter, Yogyakarta', text: 'Kalender pembayaran sangat membantu. Dulu sering lupa jatuh tempo, sekarang semua terjadwal rapi. Auto-marking fiturnya brilliant.', avatar: 400 },
      { name: 'Hendra Wijaya', role: 'PNS, Medan', text: 'Family mode game changer. Istri dan saya sekarang punya visibility yang sama soal keuangan keluarga. Tidak ada lagi yang disembunyikan.', avatar: 500 },
      { name: 'Maya Putri', role: 'Content Creator, Bali', text: 'Sebagai freelancer dengan income tidak tetap, fitur multi-income dan smart allocation sangat membantu. Akhirnya bisa nabung konsisten!', avatar: 600 },
    ],
    price_title: 'Mulai Gratis. Upgrade Sesuai Kebutuhan.',
    price_sub: 'Semua fitur dasar gratis selamanya. Upgrade untuk AI canggih dan fitur keluarga.',
    price_loading: 'Memuat paket...',
    price_free_badge: 'Paling Populer',
    price_premium_badge: 'Terbaik',
    price_per_month: '/bulan',
    price_cta_free: 'Mulai Gratis',
    price_cta_paid: 'Coba 7 Hari',
    price_ai_limit: 'kueri AI/hari',
    faq_title: 'Pertanyaan Umum',
    faq_sub: 'Semua yang perlu Anda tahu tentang bebas hutang bersama Paydone.',
    faqs: [
      { q: 'Apakah Paydone gratis?', a: 'Ya, Paydone sepenuhnya gratis untuk pengguna personal. Fitur dasar seperti tracking hutang, simulator, dan AI strategist dapat diakses tanpa biaya apapun.' },
      { q: 'Apakah data keuangan saya aman?', a: 'Sangat aman. Data terenkripsi end-to-end dan disimpan secara lokal. Sync ke cloud bersifat opsional dengan enkripsi standar industri. Kami tidak pernah menjual data pengguna.' },
      { q: 'Hutang apa saja yang bisa ditrack?', a: 'Semua jenis hutang: KPR, KKB, KTA, Kartu Kredit, pinjaman online, dan hutang personal. Masing-masing memiliki kalkulasi bunga yang sesuai.' },
      { q: 'Bagaimana AI Strategist bekerja?', a: 'AI menganalisa total hutang, suku bunga, sisa tenor, dan profil penghasilan Anda, lalu merekomendasikan urutan pelunasan optimal — Snowball atau Avalanche.' },
      { q: 'Bisa digunakan untuk keluarga?', a: 'Ya! Fitur Family Mode memungkinkan Anda mengelola keuangan bersama pasangan atau anggota keluarga dengan visibilitas bersama.' },
      { q: 'Apakah perlu koneksi internet?', a: 'Tidak selalu. Paydone bekerja secara offline-first. Data disimpan lokal dan akan sync otomatis saat koneksi tersedia.' },
    ],
    news_title: 'Jadilah Lebih Cerdas soal Uang',
    news_sub: 'Bergabunglah dengan newsletter kami untuk strategi pelunasan, tips budgeting, dan update fitur.',
    news_placeholder: 'Masukkan alamat email Anda',
    news_cta: 'Berlangganan',
    news_success: '🎉 Berhasil! Cek inbox Anda.',
    news_error: 'Masukkan email yang valid.',
    news_no_spam: 'Tanpa spam. Berhenti kapan saja.',
    final_title: 'Masa Depan Bebas Hutang Anda Dimulai Hari Ini.',
    final_sub: 'Jangan biarkan bunga berbunga memakan masa depan Anda. Bergabunglah dengan 2,847+ pengguna yang sudah selangkah lebih maju.',
    final_cta: 'Mulai Perjalanan Saya Gratis →',
    footer_tagline: 'Manajemen kebebasan hutang & budget berbasis AI.',
    footer_links: 'Privasi · Syarat · Blog · Bantuan',
    footer_rights: '© 2025 Paydone. Hak cipta dilindungi.',
  },

  // ─── SPANISH ────────────────────────────────────────────────────────────────
  es: {
    badge: '🏆 Gestor de Deudas y Presupuesto con IA',
    hero_h1_a: 'Liberarse de las Deudas.',
    hero_h1_b: '',
    typewords: ['Paga más rápido.', 'Ahorra más.', 'Vive libre.'],
    hero_sub: 'No es solo una calculadora. Es un ',
    hero_sub_bold1: 'motor de estrategia con IA',
    hero_sub_bold2: ' que revela cargos bancarios ocultos, optimiza tu presupuesto y te da ',
    hero_cta_bridge: 'el camino más rápido hacia la libertad financiera.',
    cta_main: 'Empieza gratis',
    cta_secondary: 'Probar simulador',
    active_users: ' usuarios activos',
    nav_simulator: 'Simulador',
    nav_features: 'Funciones',
    nav_strategy: 'Estrategia IA',
    nav_pricing: 'Precios',
    nav_faq: 'Preguntas',
    nav_blog: 'Blog',
    nav_login: 'Iniciar sesión',
    nav_register: 'Registro gratuito',
    calc_title: 'Calculadora de Libertad de Deuda',
    calc_sub: 'Descubre cuánto antes puedes estar libre de deudas',
    calc_debt: 'Deuda total',
    calc_monthly: 'Pago mensual',
    calc_rate: 'Tasa de interés anual',
    calc_standard: 'Sin estrategia',
    calc_optimized: 'Con Paydone IA',
    calc_years: 'años',
    calc_months: 'meses',
    calc_save_interest: 'Intereses ahorrados',
    calc_save_time: 'Tiempo ahorrado',
    calc_cta: 'Crear mi plan de pago →',
    stat_users: 'Usuarios activos',
    stat_saved: 'Intereses ahorrados',
    stat_avg: 'Más rápido de promedio',
    stat_rating: 'Valoración de usuarios',
    feat_title: 'Todas las herramientas para ganar',
    feat_sub: 'Desde el seguimiento de deudas hasta la planificación presupuestaria — todo funciona de forma inteligente.',
    feat_items: [
      { icon: 'brain', title: 'Estratega IA de Deudas', desc: 'La IA analiza tu perfil de deuda y selecciona automáticamente la estrategia Bola de Nieve (psicológica) o Avalancha (matemática) según tus datos reales.' },
      { icon: 'pie', title: 'Asignación inteligente', desc: 'Categoriza automáticamente cada gasto en Necesidades, Deseos y Obligaciones de Deuda con ratios óptimos.' },
      { icon: 'shield', title: 'Rastreador de libertad', desc: 'Simulador completo del futuro. Calcula los activos necesarios para la jubilación y el camino para alcanzarlos una vez libre de deudas.' },
      { icon: 'calendar', title: 'Calendario de pagos', desc: 'Calendario integrado con notificaciones automáticas de vencimiento y seguimiento de pagos por deuda con línea de tiempo visual.' },
      { icon: 'chart', title: 'Panel en tiempo real', desc: 'Gráficos interactivos con proyecciones, ratio DSR, puntuación de salud y progreso actualizado en tiempo real.' },
      { icon: 'target', title: 'Gestor de fondos de ahorro', desc: 'Gestiona metas de ahorro visualmente. Prepara entrada de casa, fondo de emergencia o vacaciones con asignación automática inteligente.' },
    ],
    how_title: 'De la deuda a la libertad en 4 pasos',
    how_sub: 'Empieza en 30 segundos. Sin tarjeta de crédito. Sin datos bancarios.',
    how_steps: [
      { title: 'Registro gratuito', desc: 'Crea tu cuenta en 30 segundos. No se necesita tarjeta de crédito ni datos bancarios sensibles.' },
      { title: 'Añade tus deudas', desc: 'Ingresa los detalles: hipoteca, préstamo de auto, personal o tarjeta de crédito. La IA detecta cargos ocultos automáticamente.' },
      { title: 'Análisis IA', desc: 'El sistema analiza y recomienda la estrategia de pago más rápida adaptada a tu perfil financiero.' },
      { title: 'Ejecuta y monitorea', desc: 'Sigue tu hoja de ruta diaria. Rastrea el progreso, recibe notificaciones y observa cómo decrece tu deuda cada día.' },
    ],
    strat_title: 'Dos estrategias. Una IA inteligente.',
    strat_sub: 'Paydone IA selecciona la estrategia óptima basándose en tus datos reales — no en suposiciones.',
    strat_snowball_title: 'Método Bola de Nieve',
    strat_snowball_sub: 'Impulso psicológico',
    strat_snowball_desc: 'Paga primero la deuda más pequeña. Cada liquidación crea una victoria psicológica que impulsa la disciplina para afrontar la siguiente.',
    strat_snowball_pros: ['Victorias rápidas que mantienen la motivación', 'Reduce el número de deudas rápidamente', 'Ideal para la disciplina emocional'],
    strat_avalanche_title: 'Método Avalancha',
    strat_avalanche_sub: 'Optimización matemática',
    strat_avalanche_desc: 'Paga primero la deuda con mayor interés. Minimiza el total de intereses pagados y te libera de deudas más rápido en términos financieros.',
    strat_avalanche_pros: ['Máximo ahorro en intereses', 'Ruta matemáticamente óptima', 'Ideal para tarjetas de crédito con altas tasas'],
    strat_example_label: 'Ejemplo de orden de pago',
    strat_saved_label: 'Intereses estimados ahorrados',
    test_title: 'Personas reales. Resultados reales.',
    test_sub: 'Únete a miles de personas que ya han comenzado su camino hacia la libertad financiera.',
    testimonials: [
      { name: 'Carlos García', role: 'Ingeniero de software, Madrid', text: 'Pagaba mínimos al azar por todas partes. Paydone me mostró que podría ahorrar €9.200 en intereses hipotecarios usando la Avalancha. Cambió mi vida.', avatar: 111 },
      { name: 'María López', role: 'Freelance, Barcelona', text: 'La función de asignación de presupuesto me hizo disciplinada. Mi salario se divide automáticamente en necesidades, deseos y deuda. El estrés bajó muchísimo.', avatar: 222 },
      { name: 'Javier Martínez', role: 'Empresario, Valencia', text: 'El simulador de costos reales fue revelador. Mi "entrada del 20%" era en realidad un 31% con todos los cargos ocultos. Ojalá lo hubiera sabido antes.', avatar: 333 },
      { name: 'Ana Fernández', role: 'Médica, Sevilla', text: 'El calendario de pagos es brillante. Antes olvidaba las fechas de vencimiento; ahora todo está perfectamente programado. La función de marcado automático es increíble.', avatar: 444 },
      { name: 'Miguel Torres', role: 'Funcionario, Bilbao', text: 'El modo familiar cambió todo. Mi esposa y yo finalmente tenemos la misma visibilidad sobre nuestras finanzas. No más secretos económicos.', avatar: 555 },
      { name: 'Laura Sánchez', role: 'Creadora de contenido, Málaga', text: 'Como freelance con ingresos irregulares, el seguimiento multi-ingresos y la asignación inteligente son salvavidas. Por fin ahorro de forma consistente.', avatar: 666 },
    ],
    price_title: 'Empieza gratis. Mejora cuando estés listo.',
    price_sub: 'Todas las funciones principales gratis para siempre. Actualiza para IA avanzada y funciones familiares.',
    price_loading: 'Cargando planes...',
    price_free_badge: 'Más popular',
    price_premium_badge: 'Mejor valor',
    price_per_month: '/mes',
    price_cta_free: 'Empezar gratis',
    price_cta_paid: 'Iniciar prueba de 7 días',
    price_ai_limit: 'consultas IA/día',
    faq_title: 'Preguntas frecuentes',
    faq_sub: 'Todo lo que necesitas saber para liberarte de deudas con Paydone.',
    faqs: [
      { q: '¿Es gratuito Paydone?', a: 'Sí, Paydone es completamente gratuito para uso personal. Las funciones principales como el seguimiento de deudas, el simulador y el estratega IA son accesibles sin coste.' },
      { q: '¿Están seguros mis datos financieros?', a: 'Absolutamente. Tus datos están cifrados de extremo a extremo y se almacenan localmente primero. La sincronización en la nube es opcional. Nunca vendemos datos de usuario.' },
      { q: '¿Qué tipos de deuda puedo rastrear?', a: 'Todos los tipos: hipoteca, préstamo de auto, préstamo personal, tarjetas de crédito, préstamos estudiantiles y deudas personales. Cada uno tiene cálculos de interés apropiados.' },
      { q: '¿Cómo funciona el Estratega IA?', a: 'Nuestra IA analiza tu deuda total, tasas de interés, tenencia restante y perfil de ingresos, luego recomienda el orden de pago óptimo — Bola de Nieve o Avalancha.' },
      { q: '¿Se puede usar para la familia?', a: '¡Sí! El Modo Familiar te permite gestionar las finanzas junto con tu pareja o familiares. Cada persona tiene una cuenta separada pero puede ver el panorama financiero familiar.' },
      { q: '¿Necesito conexión a internet?', a: 'No siempre. Paydone funciona sin conexión primero. Los datos se almacenan localmente y se sincronizan automáticamente cuando hay conexión.' },
    ],
    news_title: 'Sé más inteligente con el dinero',
    news_sub: 'Únete a nuestro boletín para estrategias de pago de deudas, consejos de presupuesto y actualizaciones.',
    news_placeholder: 'Introduce tu dirección de correo',
    news_cta: 'Suscribirse',
    news_success: '🎉 ¡Suscrito! Revisa tu bandeja de entrada.',
    news_error: 'Por favor, introduce un correo válido.',
    news_no_spam: 'Sin spam. Cancela cuando quieras.',
    final_title: 'Tu futuro sin deudas empieza hoy.',
    final_sub: 'No dejes que el interés compuesto robe tu futuro. Únete a más de 2,847 usuarios ya en camino a la libertad financiera.',
    final_cta: 'Empezar mi camino gratis →',
    footer_tagline: 'Gestión de libertad de deudas y presupuesto con IA.',
    footer_links: 'Privacidad · Términos · Blog · Soporte',
    footer_rights: '© 2025 Paydone. Todos los derechos reservados.',
  },

  // ─── FRENCH ─────────────────────────────────────────────────────────────────
  fr: {
    badge: '🏆 Gestionnaire de Dettes & Budget par IA',
    hero_h1_a: 'Libérez-vous des Dettes.',
    hero_h1_b: '',
    typewords: ['Remboursez plus vite.', 'Épargnez plus.', 'Vivez libre.'],
    hero_sub: 'Pas juste une calculatrice. Un ',
    hero_sub_bold1: 'moteur de stratégie IA',
    hero_sub_bold2: ' qui révèle les frais bancaires cachés, optimise votre budget et vous offre ',
    hero_cta_bridge: 'le chemin le plus rapide vers la liberté financière.',
    cta_main: 'Commencer gratuitement',
    cta_secondary: 'Essayer le simulateur',
    active_users: ' utilisateurs actifs',
    nav_simulator: 'Simulateur',
    nav_features: 'Fonctionnalités',
    nav_strategy: 'Stratégie IA',
    nav_pricing: 'Tarifs',
    nav_faq: 'FAQ',
    nav_blog: 'Blog',
    nav_login: 'Connexion',
    nav_register: 'Inscription gratuite',
    calc_title: 'Calculateur de Liberté de Dette',
    calc_sub: 'Voyez exactement quand vous pouvez être libre de dettes',
    calc_debt: 'Dette totale',
    calc_monthly: 'Paiement mensuel',
    calc_rate: 'Taux d\'intérêt annuel',
    calc_standard: 'Sans stratégie',
    calc_optimized: 'Avec Paydone IA',
    calc_years: 'ans',
    calc_months: 'mois',
    calc_save_interest: 'Intérêts économisés',
    calc_save_time: 'Temps économisé',
    calc_cta: 'Créer mon plan de remboursement →',
    stat_users: 'Utilisateurs actifs',
    stat_saved: 'Intérêts économisés',
    stat_avg: 'Plus rapide en moyenne',
    stat_rating: 'Note utilisateurs',
    feat_title: 'Tous les outils pour réussir',
    feat_sub: 'Du suivi des dettes à la planification budgétaire — tout fonctionne intelligemment ensemble.',
    feat_items: [
      { icon: 'brain', title: 'Stratège IA en Dettes', desc: 'L\'IA analyse votre profil de dette et sélectionne automatiquement la stratégie Boule de Neige (psychologique) ou Avalanche (mathématique) selon vos données réelles.' },
      { icon: 'pie', title: 'Allocation budgétaire intelligente', desc: 'Catégorise automatiquement chaque dépense en Besoins, Envies et Obligations de Dette avec des ratios optimaux.' },
      { icon: 'shield', title: 'Suivi de liberté financière', desc: 'Simulateur complet du futur. Calculez les actifs retraite nécessaires et le chemin pour les atteindre une fois libéré des dettes.' },
      { icon: 'calendar', title: 'Calendrier de paiements', desc: 'Calendrier intégré avec notifications automatiques d\'échéance et suivi des paiements par dette avec chronologie visuelle.' },
      { icon: 'chart', title: 'Tableau de bord temps réel', desc: 'Graphiques interactifs avec projections, ratio DSR, score de santé et progression mise à jour en temps réel.' },
      { icon: 'target', title: 'Gestionnaire de fonds réservés', desc: 'Gérez visuellement vos objectifs d\'épargne. Préparez un apport immobilier, un fonds d\'urgence ou des vacances avec allocation automatique intelligente.' },
    ],
    how_title: 'De la dette à la liberté en 4 étapes',
    how_sub: 'Commencez en 30 secondes. Sans carte de crédit. Sans données bancaires.',
    how_steps: [
      { title: 'Inscription gratuite', desc: 'Créez votre compte en 30 secondes. Aucune carte de crédit ou donnée bancaire sensible requise.' },
      { title: 'Ajoutez vos dettes', desc: 'Saisissez les détails : prêt immobilier, auto, personnel ou carte de crédit. L\'IA détecte les frais cachés automatiquement.' },
      { title: 'Analyse IA', desc: 'Le système analyse et recommande la stratégie de remboursement la plus rapide adaptée à votre profil financier.' },
      { title: 'Exécutez et surveillez', desc: 'Suivez votre feuille de route quotidienne. Suivez la progression, recevez des notifications et regardez votre dette diminuer chaque jour.' },
    ],
    strat_title: 'Deux stratégies. Une IA intelligente.',
    strat_sub: 'Paydone IA sélectionne la stratégie optimale selon vos données réelles — pas au hasard.',
    strat_snowball_title: 'Méthode Boule de Neige',
    strat_snowball_sub: 'Élan psychologique',
    strat_snowball_desc: 'Remboursez d\'abord la plus petite dette. Chaque remboursement crée une victoire psychologique qui alimente la discipline pour attaquer la suivante.',
    strat_snowball_pros: ['Victoires rapides pour rester motivé', 'Réduit vite le nombre de dettes', 'Idéal pour la discipline émotionnelle'],
    strat_avalanche_title: 'Méthode Avalanche',
    strat_avalanche_sub: 'Optimisation mathématique',
    strat_avalanche_desc: 'Remboursez d\'abord la dette au taux le plus élevé. Minimise le total des intérêts payés et vous libère plus vite en termes purement financiers.',
    strat_avalanche_pros: ['Économies d\'intérêts maximales', 'Parcours mathématiquement optimal', 'Idéal pour les cartes à taux élevés'],
    strat_example_label: 'Exemple d\'ordre de remboursement',
    strat_saved_label: 'Intérêts estimés économisés',
    test_title: 'Vraies personnes. Vrais résultats.',
    test_sub: 'Rejoignez des milliers de personnes déjà en chemin vers la liberté financière.',
    testimonials: [
      { name: 'Thomas Dupont', role: 'Ingénieur logiciel, Paris', text: 'Je payais des minimums au hasard partout. Paydone m\'a montré que je pouvais économiser €11.500 d\'intérêts hypothécaires avec l\'Avalanche. Transformateur.', avatar: 121 },
      { name: 'Sophie Martin', role: 'Freelance, Lyon', text: 'La fonction d\'allocation budgétaire m\'a rendu disciplinée. Mon salaire se divise automatiquement en besoins, envies et dette chaque mois. Le stress a énormément diminué.', avatar: 232 },
      { name: 'Pierre Bernard', role: 'Entrepreneur, Marseille', text: 'Le simulateur de coût réel était révélateur. Mon "apport de 20%" était en réalité 30% avec tous les frais cachés. J\'aurais aimé le savoir plus tôt.', avatar: 343 },
      { name: 'Dr. Claire Moreau', role: 'Médecin, Toulouse', text: 'Le calendrier de paiements est brillant. J\'oubliais les dates d\'échéance, maintenant tout est parfaitement planifié. La fonction de marquage automatique est incroyable.', avatar: 454 },
      { name: 'Luc Rousseau', role: 'Fonctionnaire, Bordeaux', text: 'Le mode famille est révolutionnaire. Ma femme et moi avons enfin la même visibilité sur nos finances. Plus de secrets financiers entre nous.', avatar: 565 },
      { name: 'Emma Lefevre', role: 'Créatrice de contenu, Nice', text: 'En tant que freelance aux revenus irréguliers, le suivi multi-revenus et l\'allocation intelligente sont indispensables. J\'épargne enfin de façon régulière.', avatar: 676 },
    ],
    price_title: 'Commencez gratuitement. Évoluez quand vous êtes prêt.',
    price_sub: 'Toutes les fonctions de base gratuites à vie. Passez au niveau supérieur pour l\'IA avancée.',
    price_loading: 'Chargement des plans...',
    price_free_badge: 'Le plus populaire',
    price_premium_badge: 'Meilleur rapport qualité-prix',
    price_per_month: '/mois',
    price_cta_free: 'Commencer gratuitement',
    price_cta_paid: 'Essai de 7 jours',
    price_ai_limit: 'requêtes IA/jour',
    faq_title: 'Questions fréquentes',
    faq_sub: 'Tout ce que vous devez savoir pour vous libérer de vos dettes avec Paydone.',
    faqs: [
      { q: 'Paydone est-il gratuit ?', a: 'Oui, Paydone est entièrement gratuit pour usage personnel. Les fonctions principales comme le suivi des dettes, le simulateur et le stratège IA sont accessibles sans frais.' },
      { q: 'Mes données financières sont-elles sécurisées ?', a: 'Absolument. Vos données sont chiffrées de bout en bout et stockées localement en premier. La synchronisation cloud est optionnelle. Nous ne vendons jamais les données utilisateur.' },
      { q: 'Quels types de dettes puis-je suivre ?', a: 'Tous les types : prêt immobilier, auto, personnel, cartes de crédit, prêts étudiants et dettes personnelles. Chacun a des calculs d\'intérêt appropriés.' },
      { q: 'Comment fonctionne le Stratège IA ?', a: 'Notre IA analyse votre dette totale, les taux d\'intérêt, la durée restante et votre profil de revenus, puis recommande l\'ordre de remboursement optimal — Boule de Neige ou Avalanche.' },
      { q: 'Peut-il être utilisé pour la famille ?', a: 'Oui ! Le Mode Famille vous permet de gérer les finances avec votre conjoint ou des membres de la famille. Chacun a un compte séparé mais peut voir la situation financière familiale globale.' },
      { q: 'Ai-je besoin d\'une connexion internet ?', a: 'Pas toujours. Paydone fonctionne hors ligne en priorité. Les données sont stockées localement et synchronisées automatiquement à la connexion.' },
    ],
    news_title: 'Devenez plus intelligent avec l\'argent',
    news_sub: 'Rejoignez notre newsletter pour des stratégies de remboursement, conseils budgétaires et mises à jour.',
    news_placeholder: 'Entrez votre adresse e-mail',
    news_cta: "S'abonner",
    news_success: '🎉 Abonné ! Vérifiez votre boîte de réception.',
    news_error: 'Veuillez entrer un e-mail valide.',
    news_no_spam: 'Pas de spam. Désabonnez-vous à tout moment.',
    final_title: 'Votre avenir sans dettes commence aujourd\'hui.',
    final_sub: 'Ne laissez pas les intérêts composés voler votre avenir. Rejoignez plus de 2 847 utilisateurs déjà sur la voie de la liberté financière.',
    final_cta: 'Commencer mon parcours gratuitement →',
    footer_tagline: 'Gestion de la liberté de dette et du budget par IA.',
    footer_links: 'Confidentialité · Conditions · Blog · Support',
    footer_rights: '© 2025 Paydone. Tous droits réservés.',
  },

  // ─── RUSSIAN ─────────────────────────────────────────────────────────────────
  ru: {
    badge: '🏆 ИИ-менеджер долгов и бюджета',
    hero_h1_a: 'Освободитесь от долгов.',
    hero_h1_b: '',
    typewords: ['Погашайте быстрее.', 'Экономьте больше.', 'Живите свободно.'],
    hero_sub: 'Не просто калькулятор. Полноценный ',
    hero_sub_bold1: 'ИИ-движок стратегий',
    hero_sub_bold2: ', который раскрывает скрытые банковские комиссии, оптимизирует бюджет и показывает ',
    hero_cta_bridge: 'самый быстрый путь к финансовой свободе.',
    cta_main: 'Начать бесплатно',
    cta_secondary: 'Попробовать симулятор',
    active_users: ' активных пользователей',
    nav_simulator: 'Симулятор',
    nav_features: 'Функции',
    nav_strategy: 'Стратегия ИИ',
    nav_pricing: 'Тарифы',
    nav_faq: 'Вопросы',
    nav_blog: 'Блог',
    nav_login: 'Войти',
    nav_register: 'Зарегистрироваться',
    calc_title: 'Калькулятор Финансовой Свободы',
    calc_sub: 'Узнайте точно, когда вы сможете стать свободным от долгов',
    calc_debt: 'Общий долг',
    calc_monthly: 'Ежемесячный платёж',
    calc_rate: 'Годовая процентная ставка',
    calc_standard: 'Без стратегии',
    calc_optimized: 'С Paydone ИИ',
    calc_years: 'лет',
    calc_months: 'мес.',
    calc_save_interest: 'Сэкономлено процентов',
    calc_save_time: 'Сэкономлено времени',
    calc_cta: 'Создать мой план погашения →',
    stat_users: 'Активных пользователей',
    stat_saved: 'Сэкономлено процентов',
    stat_avg: 'Быстрее в среднем',
    stat_rating: 'Оценка пользователей',
    feat_title: 'Все инструменты для победы',
    feat_sub: 'От отслеживания долгов до планирования бюджета — всё работает вместе умно.',
    feat_items: [
      { icon: 'brain', title: 'ИИ-стратег по долгам', desc: 'ИИ анализирует ваш профиль долгов и автоматически выбирает метод Снежного кома (психологический) или Лавины (математический) — тот, что освободит вас быстрее.' },
      { icon: 'pie', title: 'Умное распределение бюджета', desc: 'Автоматически делит каждый расход на Нужды, Желания и Долговые обязательства с оптимальными пропорциями.' },
      { icon: 'shield', title: 'Трекер финансовой свободы', desc: 'Полный симулятор будущего. Рассчитайте необходимые пенсионные активы и путь к ним после погашения долгов.' },
      { icon: 'calendar', title: 'Календарь платежей', desc: 'Интегрированный календарь с автоматическими уведомлениями о сроках и отслеживанием платежей по каждому долгу с визуальной шкалой времени.' },
      { icon: 'chart', title: 'Панель в реальном времени', desc: 'Интерактивные графики с прогнозами, коэффициентом DSR, оценкой здоровья финансов и прогрессом погашения в реальном времени.' },
      { icon: 'target', title: 'Менеджер накопительных фондов', desc: 'Управляйте целями сбережений визуально. Подготовьте первоначальный взнос, фонд экстренного реагирования или отпуск с умным автоматическим распределением.' },
    ],
    how_title: 'От долгов к свободе за 4 шага',
    how_sub: 'Начните за 30 секунд. Без кредитной карты. Без банковских данных.',
    how_steps: [
      { title: 'Бесплатная регистрация', desc: 'Создайте аккаунт за 30 секунд. Не требуется кредитная карта или конфиденциальные банковские данные.' },
      { title: 'Добавьте долги', desc: 'Введите детали: ипотека, автокредит, потребительский кредит или кредитная карта. ИИ автоматически обнаружит скрытые комиссии.' },
      { title: 'Анализ ИИ', desc: 'Система анализирует и рекомендует самую быструю стратегию погашения, адаптированную к вашему финансовому профилю.' },
      { title: 'Выполняйте и контролируйте', desc: 'Следуйте ежедневной дорожной карте. Отслеживайте прогресс, получайте уведомления и наблюдайте, как долг уменьшается каждый день.' },
    ],
    strat_title: 'Две стратегии. Один умный ИИ.',
    strat_sub: 'Paydone ИИ выбирает оптимальную стратегию на основе ваших реальных данных — без угадывания.',
    strat_snowball_title: 'Метод Снежного кома',
    strat_snowball_sub: 'Психологический импульс',
    strat_snowball_desc: 'Сначала погасите наименьший долг. Каждое погашение создаёт психологическую победу, которая питает дисциплину для следующего.',
    strat_snowball_pros: ['Быстрые победы поддерживают мотивацию', 'Быстро сокращает количество долгов', 'Лучший выбор для эмоциональной дисциплины'],
    strat_avalanche_title: 'Метод Лавины',
    strat_avalanche_sub: 'Математическая оптимизация',
    strat_avalanche_desc: 'Сначала погасите долг с наибольшей процентной ставкой. Минимизирует общие выплаченные проценты и быстрее освобождает вас в финансовом плане.',
    strat_avalanche_pros: ['Максимальная экономия на процентах', 'Математически оптимальный путь', 'Лучший выбор для кредитных карт с высокими ставками'],
    strat_example_label: 'Пример порядка погашения',
    strat_saved_label: 'Расчётная экономия на процентах',
    test_title: 'Реальные люди. Реальные результаты.',
    test_sub: 'Присоединяйтесь к тысячам, уже начавшим путь к финансовой свободе.',
    testimonials: [
      { name: 'Александр Иванов', role: 'Разработчик ПО, Москва', text: 'Платил случайные минимумы везде. Paydone показал, что могу сэкономить ₽680 000 на процентах по ипотеке с методом Лавины. Изменило всё.', avatar: 131 },
      { name: 'Мария Петрова', role: 'Фрилансер, Санкт-Петербург', text: 'Функция распределения бюджета наконец-то сделала меня дисциплинированной. Зарплата автоматически делится на нужды, желания и долги. Стресс резко упал.', avatar: 242 },
      { name: 'Дмитрий Сидоров', role: 'Предприниматель, Екатеринбург', text: 'Симулятор реальных затрат открыл глаза. Мой "первоначальный взнос 20%" оказался 31% со всеми скрытыми комиссиями. Лучше бы знал раньше.', avatar: 353 },
      { name: 'Елена Козлова', role: 'Врач, Новосибирск', text: 'Календарь платежей великолепен. Раньше забывал даты платежей, теперь всё идеально запланировано. Функция автоматической отметки превосходна.', avatar: 464 },
      { name: 'Сергей Смирнов', role: 'Госслужащий, Казань', text: 'Семейный режим — настоящая игра-чейнджер. Жена и я наконец имеем одинаковое представление о финансах семьи. Никаких больше тайн.', avatar: 575 },
      { name: 'Анна Волкова', role: 'Контент-мейкер, Краснодар', text: 'Как фрилансер с нерегулярным доходом, отслеживание множества источников и умное распределение — спасение. Наконец экономлю стабильно.', avatar: 686 },
    ],
    price_title: 'Начните бесплатно. Улучшайте когда готовы.',
    price_sub: 'Все основные функции бесплатно навсегда. Улучшите для продвинутого ИИ.',
    price_loading: 'Загрузка тарифов...',
    price_free_badge: 'Самый популярный',
    price_premium_badge: 'Лучшее соотношение',
    price_per_month: '/месяц',
    price_cta_free: 'Начать бесплатно',
    price_cta_paid: 'Начать 7-дневный пробный период',
    price_ai_limit: 'запросов ИИ/день',
    faq_title: 'Частые вопросы',
    faq_sub: 'Всё, что нужно знать, чтобы стать свободным от долгов с Paydone.',
    faqs: [
      { q: 'Paydone бесплатный?', a: 'Да, Paydone полностью бесплатен для личного использования. Основные функции, такие как отслеживание долгов, симулятор и ИИ-стратег, доступны без оплаты.' },
      { q: 'Мои финансовые данные в безопасности?', a: 'Абсолютно. Ваши данные зашифрованы сквозным шифрованием и сначала хранятся локально. Синхронизация с облаком опциональна. Мы никогда не продаём пользовательские данные.' },
      { q: 'Какие долги я могу отслеживать?', a: 'Все виды: ипотека, автокредит, потребительский кредит, кредитные карты, студенческие кредиты и личные долги. У каждого свои расчёты процентов.' },
      { q: 'Как работает ИИ-стратег?', a: 'Наш ИИ анализирует общий долг, процентные ставки, оставшийся срок и ваш доход, затем рекомендует оптимальный порядок погашения — Снежный ком или Лавина.' },
      { q: 'Можно использовать для семьи?', a: 'Да! Семейный режим позволяет управлять финансами вместе с супругом или членами семьи. У каждого отдельный аккаунт, но все видят общую финансовую картину.' },
      { q: 'Нужно ли интернет-подключение?', a: 'Не всегда. Paydone работает в первую очередь офлайн. Данные хранятся локально и автоматически синхронизируются при подключении.' },
    ],
    news_title: 'Станьте умнее в финансах',
    news_sub: 'Подпишитесь на нашу рассылку для стратегий погашения долгов, советов по бюджету и обновлений.',
    news_placeholder: 'Введите ваш адрес электронной почты',
    news_cta: 'Подписаться',
    news_success: '🎉 Подписка оформлена! Проверьте вашу почту.',
    news_error: 'Пожалуйста, введите корректный e-mail.',
    news_no_spam: 'Никакого спама. Отпишитесь в любое время.',
    final_title: 'Ваше будущее без долгов начинается сегодня.',
    final_sub: 'Не позволяйте сложным процентам красть ваше будущее. Присоединяйтесь к более чем 2 847 пользователям, уже на пути к финансовой свободе.',
    final_cta: 'Начать мой путь бесплатно →',
    footer_tagline: 'ИИ-управление освобождением от долгов и бюджетом.',
    footer_links: 'Конфиденциальность · Условия · Блог · Поддержка',
    footer_rights: '© 2025 Paydone. Все права защищены.',
  },

  // ─── ARABIC (RTL) ────────────────────────────────────────────────────────────
  ar: {
    badge: '🏆 مدير الديون والميزانية بالذكاء الاصطناعي',
    hero_h1_a: 'تحرّر من الديون.',
    hero_h1_b: '',
    typewords: ['سدّد أسرع.', 'وفّر أكثر.', 'عش بحرية.'],
    hero_sub: 'ليس مجرد حاسبة. إنه ',
    hero_sub_bold1: 'محرك استراتيجي بالذكاء الاصطناعي',
    hero_sub_bold2: ' يكشف الرسوم المخفية للبنوك، ويُحسّن ميزانيتك، ويمنحك ',
    hero_cta_bridge: 'أسرع طريق نحو الحرية المالية.',
    cta_main: 'ابدأ مجاناً',
    cta_secondary: 'جرّب المحاكي',
    active_users: ' مستخدم نشط',
    nav_simulator: 'المحاكي',
    nav_features: 'المميزات',
    nav_strategy: 'استراتيجية الذكاء الاصطناعي',
    nav_pricing: 'الأسعار',
    nav_faq: 'الأسئلة الشائعة',
    nav_blog: 'المدونة',
    nav_login: 'تسجيل الدخول',
    nav_register: 'سجّل مجاناً',
    calc_title: 'حاسبة الحرية من الديون',
    calc_sub: 'اعرف بالضبط متى ستتحرر من ديونك',
    calc_debt: 'إجمالي الدين',
    calc_monthly: 'الدفعة الشهرية',
    calc_rate: 'معدل الفائدة السنوي',
    calc_standard: 'بدون استراتيجية',
    calc_optimized: 'مع Paydone AI',
    calc_years: 'سنوات',
    calc_months: 'أشهر',
    calc_save_interest: 'الفائدة الموفّرة',
    calc_save_time: 'الوقت الموفّر',
    calc_cta: 'إنشاء خطة سداد ←',
    stat_users: 'مستخدم نشط',
    stat_saved: 'فائدة موفّرة',
    stat_avg: 'أسرع في المتوسط',
    stat_rating: 'تقييم المستخدمين',
    feat_title: 'كل الأدوات للفوز',
    feat_sub: 'من تتبع الديون إلى تخطيط الميزانية — كل شيء يعمل معاً بذكاء.',
    feat_items: [
      { icon: 'brain', title: 'استراتيجي الذكاء الاصطناعي للديون', desc: 'يحلّل الذكاء الاصطناعي ملف ديونك ويختار تلقائياً استراتيجية كرة الثلج (نفسية) أو الانهيار الجليدي (رياضية) — أيهما يحررك أسرع.' },
      { icon: 'pie', title: 'تخصيص ميزانية ذكي', desc: 'يُصنّف كل إنفاق تلقائياً إلى احتياجات ورغبات والتزامات ديون بنسب مثلى. مالك يعرف دائماً أين يذهب.' },
      { icon: 'shield', title: 'متتبّع الحرية المالية', desc: 'محاكي مستقبلي شامل. احسب الأصول التقاعدية المطلوبة والطريق لتحقيقها بعد سداد الديون.' },
      { icon: 'calendar', title: 'تقويم المدفوعات', desc: 'تقويم متكامل مع إشعارات تلقائية للاستحقاق وتتبع المدفوعات لكل دين مع جدول زمني مرئي.' },
      { icon: 'chart', title: 'لوحة تحكم فورية', desc: 'رسوم بيانية تفاعلية مع توقعات ونسبة DSR ودرجة الصحة المالية وتقدّم السداد محدّث في الوقت الفعلي.' },
      { icon: 'target', title: 'مدير صناديق الادخار', desc: 'أدِر أهداف الادخار بصرياً. استعدّ لدفعة أولى أو صندوق طوارئ أو إجازة بتخصيص ذكي تلقائي.' },
    ],
    how_title: 'من الديون إلى الحرية في 4 خطوات',
    how_sub: 'ابدأ خلال 30 ثانية. بدون بطاقة ائتمان. بدون بيانات مصرفية.',
    how_steps: [
      { title: 'تسجيل مجاني', desc: 'أنشئ حسابك في 30 ثانية. لا حاجة لبطاقة ائتمان أو بيانات مصرفية حساسة.' },
      { title: 'أضف ديونك', desc: 'أدخل التفاصيل: قرض عقاري أو سيارة أو شخصي أو بطاقة ائتمان. يكتشف الذكاء الاصطناعي الرسوم المخفية تلقائياً.' },
      { title: 'التحليل بالذكاء الاصطناعي', desc: 'يحلّل النظام ويوصي بأسرع استراتيجية سداد مناسبة لملفك المالي.' },
      { title: 'نفّذ وراقب', desc: 'اتّبع خارطة طريقك اليومية. تتبّع التقدم، استقبل الإشعارات، وشاهد دينك يتقلص كل يوم.' },
    ],
    strat_title: 'استراتيجيتان. ذكاء اصطناعي واحد.',
    strat_sub: 'يختار Paydone AI الاستراتيجية المثلى بناءً على بياناتك الحقيقية — لا تخمينات.',
    strat_snowball_title: 'طريقة كرة الثلج',
    strat_snowball_sub: 'زخم نفسي',
    strat_snowball_desc: 'سدّد الدين الأصغر أولاً. كل سداد يخلق انتصاراً نفسياً يُشعل الانضباط لمواجهة الدين التالي.',
    strat_snowball_pros: ['انتصارات سريعة تُبقيك متحفزاً', 'تقليل عدد الديون بسرعة', 'الأفضل للانضباط العاطفي'],
    strat_avalanche_title: 'طريقة الانهيار الجليدي',
    strat_avalanche_sub: 'تحسين رياضي',
    strat_avalanche_desc: 'سدّد الدين ذو الفائدة الأعلى أولاً. يقلّل إجمالي الفائدة المدفوعة ويحررك من الديون أسرع بالمعنى المالي البحت.',
    strat_avalanche_pros: ['أقصى توفير في الفائدة', 'المسار الرياضي الأمثل', 'الأفضل لبطاقات الائتمان عالية الفائدة'],
    strat_example_label: 'مثال على ترتيب السداد',
    strat_saved_label: 'توفير الفائدة المُقدَّر',
    test_title: 'أشخاص حقيقيون. نتائج حقيقية.',
    test_sub: 'انضم إلى آلاف الأشخاص الذين بدأوا رحلتهم نحو الحرية المالية.',
    testimonials: [
      { name: 'محمد الراشد', role: 'مهندس برمجيات، الرياض', text: 'كنت أدفع حدوداً دنيا عشوائية في كل مكان. أظهر لي Paydone أنني أستطيع توفير 35,000 ريال في فوائد القرض العقاري بطريقة الانهيار الجليدي. غيّر حياتي.', avatar: 141 },
      { name: 'فاطمة العلي', role: 'عاملة مستقلة، جدة', text: 'ميزة تخصيص الميزانية جعلتني منضبطة أخيراً. يتوزّع راتبي تلقائياً على الاحتياجات والرغبات والديون. انخفض التوتر كثيراً.', avatar: 252 },
      { name: 'أحمد الزهراني', role: 'صاحب مشروع، الدمام', text: 'محاكي التكلفة الحقيقية فتح عيني. دفعتي الأولى "بنسبة 20%" كانت في الواقع 30% مع جميع الرسوم المخفية. ليتني عرفت مبكراً.', avatar: 363 },
      { name: 'د. سارة القحطاني', role: 'طبيبة، أبوظبي', text: 'تقويم المدفوعات رائع. كنت أنسى تواريخ الاستحقاق، والآن كل شيء مجدوَل بدقة. ميزة الترقيم التلقائي مذهلة.', avatar: 474 },
      { name: 'عمر المنصور', role: 'موظف حكومي، الكويت', text: 'وضع الأسرة غيّر الأمور جذرياً. زوجتي وأنا لدينا أخيراً نفس الرؤية حول المالية الأسرية. لا أسرار مالية بعد الآن.', avatar: 585 },
      { name: 'نورة الشمري', role: 'صانعة محتوى، دبي', text: 'كمستقلة بدخل غير منتظم، تتبّع الدخل المتعدد والتخصيص الذكي منقذان للحياة. أخيراً أوفّر بشكل منتظم كل شهر.', avatar: 696 },
    ],
    price_title: 'ابدأ مجاناً. طوّر عندما تكون مستعداً.',
    price_sub: 'جميع الميزات الأساسية مجانية إلى الأبد. طوّر للذكاء الاصطناعي المتقدم.',
    price_loading: 'جارٍ تحميل الخطط...',
    price_free_badge: 'الأكثر شعبية',
    price_premium_badge: 'أفضل قيمة',
    price_per_month: '/شهر',
    price_cta_free: 'ابدأ مجاناً',
    price_cta_paid: 'ابدأ التجربة 7 أيام',
    price_ai_limit: 'استعلام AI / يوم',
    faq_title: 'الأسئلة الشائعة',
    faq_sub: 'كل ما تحتاج معرفته لتتحرر من الديون مع Paydone.',
    faqs: [
      { q: 'هل Paydone مجاني؟', a: 'نعم، Paydone مجاني تماماً للاستخدام الشخصي. الميزات الأساسية كتتبع الديون والمحاكي واستراتيجي الذكاء الاصطناعي متاحة بدون تكلفة.' },
      { q: 'هل بياناتي المالية آمنة؟', a: 'تماماً. بياناتك مشفّرة من طرف إلى طرف وتُخزَّن محلياً أولاً. المزامنة السحابية اختيارية. نحن لا نبيع بيانات المستخدمين أبداً.' },
      { q: 'ما أنواع الديون التي يمكنني تتبعها؟', a: 'جميع الأنواع: رهن عقاري، قرض سيارة، قرض شخصي، بطاقات ائتمان، قروض طلابية وديون شخصية. لكل منها حسابات فائدة مناسبة.' },
      { q: 'كيف يعمل استراتيجي الذكاء الاصطناعي؟', a: 'يحلّل الذكاء الاصطناعي إجمالي ديونك ومعدلات الفائدة والأجل المتبقي وملف دخلك، ثم يوصي بأفضل ترتيب سداد — كرة الثلج أو الانهيار الجليدي.' },
      { q: 'هل يمكن استخدامه للعائلة؟', a: 'نعم! يتيح لك وضع الأسرة إدارة المالية مع زوجك أو أفراد الأسرة. لكل شخص حساب منفصل لكن يمكن رؤية الصورة المالية الأسرية الشاملة.' },
      { q: 'هل أحتاج إلى اتصال بالإنترنت؟', a: 'ليس دائماً. يعمل Paydone أولاً دون اتصال. تُخزَّن البيانات محلياً وتُزامَن تلقائياً عند الاتصال.' },
    ],
    news_title: 'كن أذكى في المال',
    news_sub: 'انضم إلى نشرتنا الإخبارية لاستراتيجيات سداد الديون ونصائح الميزانية والتحديثات.',
    news_placeholder: 'أدخل بريدك الإلكتروني',
    news_cta: 'اشترك',
    news_success: '!🎉 تم الاشتراك! تحقق من صندوق الوارد.',
    news_error: 'يرجى إدخال بريد إلكتروني صحيح.',
    news_no_spam: 'بلا رسائل مزعجة. ألغِ الاشتراك في أي وقت.',
    final_title: 'مستقبلك بدون ديون يبدأ اليوم.',
    final_sub: 'لا تدع الفائدة المركّبة تسرق مستقبلك. انضم إلى أكثر من 2,847 مستخدم على طريق الحرية المالية.',
    final_cta: '← ابدأ رحلتي مجاناً',
    footer_tagline: '.إدارة الحرية من الديون والميزانية بالذكاء الاصطناعي',
    footer_links: 'الخصوصية · الشروط · المدونة · الدعم',
    footer_rights: '.© 2025 Paydone. جميع الحقوق محفوظة',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1600, trigger = true) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    if (!trigger) return;
    const startTime = performance.now();
    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, trigger]);
  return count;
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Typewriter({ words, className }: { words: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const word = words[idx % words.length];
    const timer = setTimeout(() => {
      if (!deleting) {
        setText(word.slice(0, text.length + 1));
        if (text.length + 1 === word.length) setTimeout(() => setDeleting(true), 2200);
      } else {
        setText(word.slice(0, text.length - 1));
        if (text.length === 0) { setDeleting(false); setIdx(i => i + 1); }
      }
    }, deleting ? 35 : 75);
    return () => clearTimeout(timer);
  }, [text, deleting, idx, words]);
  return <span className={className}>{text}<span className="opacity-70 animate-pulse">|</span></span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const FEAT_ICONS: Record<string, React.ComponentType<any>> = {
  brain: BrainCircuit, pie: PieChart, shield: ShieldCheck,
  calendar: Calendar, chart: BarChart3, target: Target,
};

function FeatureCard({ item, idx }: { item: { icon: string; title: string; desc: string }; idx: number }) {
  const { ref, inView } = useInView(0.1);
  const Icon = FEAT_ICONS[item.icon] || Zap;
  const colors = [
    { grad: 'from-violet-500 to-indigo-600', glow: 'shadow-violet-500/20', badge: 'bg-violet-500/10 text-violet-300' },
    { grad: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/20', badge: 'bg-emerald-500/10 text-emerald-300' },
    { grad: 'from-blue-500 to-cyan-600', glow: 'shadow-blue-500/20', badge: 'bg-blue-500/10 text-blue-300' },
    { grad: 'from-rose-500 to-pink-600', glow: 'shadow-rose-500/20', badge: 'bg-rose-500/10 text-rose-300' },
    { grad: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/20', badge: 'bg-amber-500/10 text-amber-300' },
    { grad: 'from-teal-500 to-green-600', glow: 'shadow-teal-500/20', badge: 'bg-teal-500/10 text-teal-300' },
  ];
  const c = colors[idx % colors.length];
  return (
    <div
      ref={ref}
      className={`group relative bg-[#0d1117] border border-white/[0.06] rounded-2xl p-7 hover:border-white/20 transition-all duration-500 cursor-default overflow-hidden ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${idx * 80}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.grad} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center mb-5 shadow-lg ${c.glow} group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={22} className="text-white" />
      </div>
      <h3 className="text-base font-bold text-white mb-2.5">{item.title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
    </div>
  );
}

function StepCard({ step, num, delay }: { step: { title: string; desc: string }; num: number; delay: number }) {
  const { ref, inView } = useInView();
  const icons = [Users, Banknote, BrainCircuit, TrendingUp];
  const Icon = icons[(num - 1) % icons.length];
  return (
    <div ref={ref} className={`flex gap-5 transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 relative">
          <Icon size={20} className="text-white" />
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-emerald-700 rounded-full text-[10px] font-black flex items-center justify-center shadow">{num}</span>
        </div>
        {num < 4 && <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500/40 to-transparent mx-auto mt-2" />}
      </div>
      <div className="pb-8">
        <h4 className="font-bold text-white text-base mb-1.5">{step.title}</h4>
        <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
      </div>
    </div>
  );
}

function TestimonialCard({ t: item, delay }: { t: { name: string; role: string; text: string; avatar: number }; delay: number }) {
  const { ref, inView } = useInView(0.1);
  return (
    <div ref={ref} className={`bg-[#0d1117] border border-white/[0.06] rounded-2xl p-6 hover:border-white/15 transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="flex gap-0.5 mb-4">{[1,2,3,4,5].map(i=><Star key={i} size={13} className="fill-amber-400 text-amber-400"/>)}</div>
      <p className="text-slate-300 text-sm leading-relaxed mb-5 italic">"{item.text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 ring-2 ring-white/10">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.avatar}`} alt={item.name} className="w-full h-full" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">{item.name}</p>
          <p className="text-slate-500 text-xs">{item.role}</p>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a, open, onClick }: { q: string; a: string; open: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button onClick={onClick} className="w-full flex items-center justify-between py-5 text-left group">
        <span className={`font-semibold text-sm transition pr-4 ${open ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'}`}>{q}</span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-180 text-emerald-400' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-400 ${open ? 'max-h-56 pb-5' : 'max-h-0'}`}>
        <p className="text-slate-400 text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [langDropOpen, setLangDropOpen] = useState(false);

  // ── Language (auto from browser, synced with global i18n) ──
  const globalI18n = useI18n();

  const [activeLang, setActiveLang] = useState<LangCode>(() => {
    // Priority: global i18n → localStorage → browser detect
    const gl = globalI18n.language;
    if (gl && STRINGS[gl as LangCode]) return gl as LangCode;
    try {
      const saved = localStorage.getItem('paydone_locale_v2');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.language && STRINGS[p.language as LangCode]) return p.language as LangCode;
      }
    } catch {}
    return detectLang();
  });

  // Keep in sync if global i18n language changes externally
  useEffect(() => {
    if (globalI18n.language && STRINGS[globalI18n.language as LangCode] && globalI18n.language !== activeLang) {
      setActiveLang(globalI18n.language as LangCode);
    }
  }, [globalI18n.language]);

  const s = STRINGS[activeLang];

  const changeLang = (lang: LangCode) => {
    setActiveLang(lang);
    setLangDropOpen(false);
    // Persist
    try {
      const meta: Record<LangCode, { cur: string; tz: string; cc: string }> = {
        en: { cur: 'USD', tz: 'America/New_York', cc: 'US' },
        zh: { cur: 'CNY', tz: 'Asia/Shanghai', cc: 'CN' },
        hi: { cur: 'INR', tz: 'Asia/Kolkata', cc: 'IN' },
        id: { cur: 'IDR', tz: 'Asia/Jakarta', cc: 'ID' },
        es: { cur: 'EUR', tz: 'Europe/Madrid', cc: 'ES' },
        fr: { cur: 'EUR', tz: 'Europe/Paris',  cc: 'FR' },
        ru: { cur: 'RUB', tz: 'Europe/Moscow', cc: 'RU' },
        ar: { cur: 'SAR', tz: 'Asia/Riyadh',   cc: 'SA' },
      };
      const m = meta[lang];
      if (m) localStorage.setItem('paydone_locale_v2', JSON.stringify({ language: lang, currency: m.cur, timezone: m.tz, country: m.cc, isAuto: false }));
    } catch {}
    // Apply RTL direction for Arabic
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (globalI18n) globalI18n.setLanguage(lang);
  };

  // ── Packages ──
  const [packages, setPackages] = useState<FreemiumPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);

  // ── Calculator ──
  const [debtAmount, setDebtAmount] = useState(100000000);
  const [monthlyPay, setMonthlyPay] = useState(2500000);
  const [interestRate, setInterestRate] = useState(12);

  const monthlyRate = interestRate / 100 / 12;
  const standardMonths = monthlyRate > 0
    ? Math.ceil(-Math.log(1 - (debtAmount * monthlyRate / monthlyPay)) / Math.log(1 + monthlyRate))
    : Math.ceil(debtAmount / monthlyPay);
  const safeStd = isFinite(standardMonths) && standardMonths > 0 ? standardMonths : Math.ceil(debtAmount / monthlyPay * 1.5);
  const optimizedMonths = Math.ceil(safeStd * 0.63);
  const savedInterest = Math.max(0, (monthlyPay * safeStd) - (monthlyPay * optimizedMonths));
  const savedMonths = safeStd - optimizedMonths;

  // ── Newsletter ──
  const [leadEmail, setLeadEmail] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    const onCfg = () => setConfig(getConfig());
    window.addEventListener('PAYDONE_CONFIG_UPDATE', onCfg);
    document.documentElement.style.scrollBehavior = 'smooth';
    // Apply RTL for Arabic on mount
    document.documentElement.dir = activeLang === 'ar' ? 'rtl' : 'ltr';
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('PAYDONE_CONFIG_UPDATE', onCfg);
      document.documentElement.style.scrollBehavior = 'auto';
      document.documentElement.dir = 'ltr'; // restore on unmount
    };
  }, []);

  useEffect(() => {
    api.get('/packages').then((data: any) => {
      const raw: any[] = Array.isArray(data) ? data : (data?.packages || []);
      setPackages(raw.filter(p => p.isActive ?? p.is_active).map(r => ({
        id: r.id, name: r.name || '', price: Number(r.price) || 0,
        ai_limit: r.aiLimit ?? r.ai_limit ?? 10,
        features: r.features || {}, is_active: true,
        is_default_free: r.isDefaultFree ?? r.is_default_free ?? false,
        description: r.description || '',
        badge_color: r.badgeColor ?? r.badge_color ?? '#3b82f6',
      })));
    }).catch(() => {}).finally(() => setPackagesLoading(false));
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');
    if (!leadEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
      setLeadError(s.news_error); return;
    }
    setLeadLoading(true);
    try {
      await api.post('/leads', { email: leadEmail.trim() });
      setLeadSuccess(true); setLeadEmail('');
    } catch { setLeadError(s.news_error); }
    finally { setLeadLoading(false); }
  };

  const appName = config.appName || 'Paydone';
  const appLogo = config.appLogoUrl;
  const langMeta = LANG_META[activeLang];

  // ── Stats ──
  const statsView = useInView();
  const u = useCountUp(2847, 1800, statsView.inView);
  const sv = useCountUp(
    activeLang === 'en' ? 8400 :
    activeLang === 'zh' ? 50000 :
    activeLang === 'hi' ? 620000 :
    activeLang === 'es' ? 9200 :
    activeLang === 'fr' ? 11500 :
    activeLang === 'ru' ? 680000 :
    activeLang === 'ar' ? 35000 :
    47000000, // id
    2000, statsView.inView
  );
  const tv = useCountUp(35, 1500, statsView.inView);

  return (
    <div className="min-h-screen bg-[#060b12] text-white antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@700;800;900&display=swap');
        @keyframes grad-x { 0%,100%{background-position:0% 50%}50%{background-position:100% 50%} }
        @keyframes float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)} }
        @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(52,211,153,.4)} 70%{box-shadow:0 0 0 12px rgba(52,211,153,0)} 100%{box-shadow:0 0 0 0 rgba(52,211,153,0)} }
        @keyframes slide-up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0}100%{background-position:200% 0} }
        @keyframes glow-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        .anim-su { animation: slide-up .8s ease-out forwards; }
        .anim-su-1 { animation: slide-up .8s ease-out .1s forwards; opacity:0; }
        .anim-su-2 { animation: slide-up .8s ease-out .2s forwards; opacity:0; }
        .anim-su-3 { animation: slide-up .8s ease-out .32s forwards; opacity:0; }
        .anim-su-4 { animation: slide-up .8s ease-out .46s forwards; opacity:0; }
        .shimmer-text {
          background: linear-gradient(90deg,#34d399,#6ee7b7,#34d399);
          background-size:200%;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          animation: shimmer 2.8s linear infinite;
        }
        .pulse-ring { animation: pulse-ring 2.2s infinite; }
        .float { animation: float 4s ease-in-out infinite; }
        .glow-pulse { animation: glow-pulse 3s ease-in-out infinite; }
        .range-thumb::-webkit-slider-thumb {
          -webkit-appearance:none; width:18px; height:18px; border-radius:50%;
          background:linear-gradient(135deg,#34d399,#059669);
          cursor:pointer; box-shadow:0 2px 8px rgba(52,211,153,.5); border:2px solid #060b12;
        }
        .range-thumb::-moz-range-thumb {
          width:18px; height:18px; border-radius:50%;
          background:linear-gradient(135deg,#34d399,#059669);
          cursor:pointer; border:2px solid #060b12;
        }
        .range-thumb { -webkit-appearance:none; appearance:none; height:4px; border-radius:999px; outline:none; cursor:pointer; }
        .glass { background:rgba(255,255,255,.03); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.07); }
        .card-hover { transition: all .35s; }
        .card-hover:hover { transform: translateY(-3px); border-color:rgba(52,211,153,.2); }
        .gradient-border {
          position:relative;
        }
        .gradient-border::before {
          content:''; position:absolute; inset:-1px; border-radius:inherit;
          background:linear-gradient(135deg,#34d399,#6366f1,#f59e0b);
          z-index:-1; opacity:0; transition:opacity .4s;
        }
        .gradient-border:hover::before { opacity:1; }
      `}</style>

      {/* ═══════════════════════════════════════════════════════
          NAVBAR
      ═══════════════════════════════════════════════════════ */}
      <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#060b12]/95 backdrop-blur-xl border-b border-white/[0.06] py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-9 h-9 object-contain rounded-xl" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Wallet size={18} className="text-white" />
              </div>
            )}
            <span className="font-black text-xl text-white tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>{appName}</span>
          </div>

          {/* Nav Links */}
          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-400">
            {[
              { id: 'simulator', l: s.nav_simulator },
              { id: 'features',  l: s.nav_features  },
              { id: 'strategy',  l: s.nav_strategy  },
              { id: 'pricing',   l: s.nav_pricing   },
              { id: 'faq',       l: s.nav_faq       },
            ].map(n => (
              <button key={n.id} onClick={() => scrollTo(n.id)} className="hover:text-white transition-colors">{n.l}</button>
            ))}
            <Link to="/blog" className="hover:text-white transition-colors">{s.nav_blog}</Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <button onClick={() => setLangDropOpen(!langDropOpen)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 text-xs font-medium transition">
                <span>{langMeta.flag}</span>
                <span className="uppercase">{activeLang}</span>
                <ChevronDown size={12} className={`transition-transform ${langDropOpen ? 'rotate-180' : ''}`} />
              </button>
              {langDropOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  {(Object.entries(LANG_META) as [LangCode, typeof LANG_META[LangCode]][]).map(([code, meta]) => (
                    <button key={code} onClick={() => changeLang(code)} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition ${activeLang === code ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                      <span>{meta.flag}</span>
                      <span>{meta.name}</span>
                      {activeLang === code && <Check size={13} className="ml-auto text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link to="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition">
              {s.nav_login}
            </Link>
            <Link to="/register" className="px-4 py-2 text-sm font-bold text-[#060b12] bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 rounded-lg transition shadow-lg shadow-emerald-500/20 pulse-ring">
              {s.nav_register}
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-slate-400 hover:text-white transition">
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0d1117] border-t border-white/[0.06] shadow-2xl">
            <div className="max-w-7xl mx-auto px-5 py-3 flex flex-col">
              {[
                { id: 'simulator', l: s.nav_simulator },
                { id: 'features',  l: s.nav_features  },
                { id: 'strategy',  l: s.nav_strategy  },
                { id: 'pricing',   l: s.nav_pricing   },
                { id: 'faq',       l: s.nav_faq       },
              ].map(n => (
                <button key={n.id} onClick={() => scrollTo(n.id)} className="px-4 py-3 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-left transition">{n.l}</button>
              ))}
              <div className="flex gap-2 mt-2 px-4">
                {(Object.entries(LANG_META) as [LangCode, typeof LANG_META[LangCode]][]).map(([code, meta]) => (
                  <button key={code} onClick={() => changeLang(code)} className={`flex-1 py-2 text-xs rounded-lg border transition ${activeLang === code ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold' : 'border-white/10 text-slate-400'}`}>
                    {meta.flag} {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-28 pb-16 lg:pt-44 lg:pb-24 px-5 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-500/[0.07] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[400px] bg-indigo-600/[0.06] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-teal-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

        {/* Grid texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 lg:gap-8 items-center">
          {/* Left */}
          <div className="space-y-7 text-center lg:text-left">
            <div className="anim-su inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-xs font-semibold tracking-wide">
              <Sparkles size={13} className="text-amber-400" />
              {s.badge}
            </div>

            <h1 className="anim-su-1 leading-[1.06] tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
              <span className="block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4rem] font-black text-white">{s.hero_h1_a}</span>
              <span className="block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4rem] font-black mt-1">
                <span className="shimmer-text">
                  <Typewriter words={s.typewords} />
                </span>
              </span>
            </h1>

            <p className="anim-su-2 text-base lg:text-lg text-slate-400 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              {s.hero_sub}<span className="text-white font-bold">{s.hero_sub_bold1}</span>
              {s.hero_sub_bold2}<span className="text-emerald-400 font-bold">{(s as any).hero_cta_bridge}</span>
            </p>

            <div className="anim-su-3 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold text-[#060b12] bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 rounded-xl transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]">
                <Zap size={16} />
                {s.cta_main}
              </Link>
              <button onClick={() => scrollTo('simulator')} className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold text-slate-200 glass rounded-xl hover:bg-white/5 transition">
                <Play size={15} className="text-emerald-400" />
                {s.cta_secondary}
              </button>
            </div>

            <div className="anim-su-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-5 pt-1">
              <div className="flex -space-x-2.5">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full ring-2 ring-[#060b12] overflow-hidden bg-slate-800">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i*130}`} alt="" className="w-full h-full" />
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-400">
                <span className="text-white font-black text-sm">2,847+</span>{s.active_users}
                <div className="flex items-center gap-1 mt-0.5 justify-center lg:justify-start">
                  {[1,2,3,4,5].map(i=><Star key={i} size={10} className="fill-amber-400 text-amber-400"/>)}
                  <span className="ml-1 font-bold text-slate-300">4.9</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Calculator */}
          <div id="simulator" className="relative" style={{ scrollMarginTop: '90px' }}>
            <div className="absolute inset-0 bg-emerald-500/5 rounded-3xl rotate-1 blur-2xl scale-105 pointer-events-none" />
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative glass rounded-3xl p-6 md:p-8 shadow-2xl float">
              <div className="flex items-center justify-between mb-7">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Calculator size={18} className="text-emerald-400" />
                    <span className="font-black text-white text-base" style={{ fontFamily: "'Sora', sans-serif" }}>{s.calc_title}</span>
                  </div>
                  <p className="text-xs text-slate-400">{s.calc_sub}</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wider">AI</span>
              </div>

              <div className="space-y-5">
                {[
                  { label: s.calc_debt, value: debtAmount, min: 10000000, max: 2000000000, step: 10000000, set: setDebtAmount },
                  { label: s.calc_monthly, value: monthlyPay, min: 500000, max: 50000000, step: 500000, set: setMonthlyPay },
                  { label: s.calc_rate, value: interestRate, min: 1, max: 36, step: 0.5, set: setInterestRate, isRate: true },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {(item as any).isRate ? `${item.value}%` : formatCurrency(item.value)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={item.min} max={item.max} step={item.step} value={item.value}
                      onChange={e => item.set(Number(e.target.value))}
                      className="range-thumb w-full"
                      style={{ background: `linear-gradient(to right,#34d399 ${((item.value-item.min)/(item.max-item.min))*100}%,rgba(255,255,255,.08) ${((item.value-item.min)/(item.max-item.min))*100}%)` }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">{s.calc_standard}</p>
                  <p className="text-xl font-black text-slate-300">
                    {(safeStd / 12).toFixed(1)}<span className="text-xs font-medium text-slate-500 ml-1">{s.calc_years}</span>
                  </p>
                  <p className="text-xs text-slate-600">{safeStd} {s.calc_months}</p>
                </div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-1">{s.calc_optimized}</p>
                  <p className="text-xl font-black text-emerald-400">
                    {(optimizedMonths / 12).toFixed(1)}<span className="text-xs font-medium text-emerald-600 ml-1">{s.calc_years}</span>
                  </p>
                  <p className="text-xs text-emerald-600">{optimizedMonths} {s.calc_months}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                  <p className="text-[10px] text-amber-500 font-bold uppercase mb-0.5">{s.calc_save_interest}</p>
                  <p className="text-sm font-black text-amber-400">{formatCurrency(savedInterest)}</p>
                </div>
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase mb-0.5">{s.calc_save_time}</p>
                  <p className="text-sm font-black text-indigo-400">{savedMonths} {s.calc_months}</p>
                </div>
              </div>

              <Link to="/register" className="mt-5 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-[#060b12] font-black text-sm transition shadow-lg shadow-emerald-500/20">
                {s.calc_cta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════════════ */}
      <section className="py-10 border-y border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-5" ref={statsView.ref}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              { val: u, suf: '+', label: s.stat_users, icon: Users },
              { val: activeLang === 'en' ? `$${(sv/1000).toFixed(0)}K` :
                       activeLang === 'zh' ? `¥${(sv/10000).toFixed(0)}万` :
                       activeLang === 'hi' ? `₹${(sv/100000).toFixed(1)}L` :
                       activeLang === 'es' ? `€${(sv/1000).toFixed(0)}K` :
                       activeLang === 'fr' ? `€${(sv/1000).toFixed(0)}K` :
                       activeLang === 'ru' ? `₽${(sv/1000).toFixed(0)}K` :
                       activeLang === 'ar' ? `﷼${(sv/1000).toFixed(0)}K` :
                       `Rp${(sv/1000000).toFixed(0)}jt`, suf: '', label: s.stat_saved, icon: TrendingDown, raw: true },
              { val: tv, suf: '%', label: s.stat_avg, icon: Flame },
              { val: 49, suf: '/5', label: s.stat_rating, icon: Star },
            ].map((st, i) => (
              <div key={i} className={`text-center transition-all duration-700 ${statsView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i*100}ms` }}>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <st.icon size={18} className="text-emerald-400" />
                </div>
                <p className="text-2xl lg:text-3xl font-black text-white">
                  {st.raw ? st.val : `${st.val}${st.suf}`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{st.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 lg:py-28 px-5" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-[0.15em] mb-3 block">Features</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>{s.feat_title}</h2>
            <p className="text-slate-400 text-base leading-relaxed">{s.feat_sub}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.feat_items.map((item, i) => <FeatureCard key={i} item={item} idx={i} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-[0.15em] mb-3 block">How It Works</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>{s.how_title}</h2>
            <p className="text-slate-400 mb-10 leading-relaxed">{s.how_sub}</p>
            <div>
              {s.how_steps.map((step, i) => <StepCard key={i} step={step} num={i+1} delay={i*100} />)}
            </div>
          </div>

          {/* Visual mockup */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 bg-emerald-500/5 rounded-3xl blur-3xl" />
            <div className="relative glass rounded-3xl p-7 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-sm">Debt Overview</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full font-bold">LIVE</span>
              </div>
              {[
                { name: 'Home Mortgage', pct: 68, color: 'from-blue-500 to-indigo-600', val: '$185,000' },
                { name: 'Car Loan', pct: 42, color: 'from-amber-500 to-orange-500', val: '$12,400' },
                { name: 'Credit Card', pct: 15, color: 'from-rose-500 to-pink-600', val: '$3,200' },
              ].map((d, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-300 font-medium">{d.name}</span>
                    <span className="text-slate-400">{d.val}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${d.color} rounded-full`} style={{ width: `${d.pct}%`, transition: 'width 1s' }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">{d.pct}% remaining</p>
                </div>
              ))}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={16} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-bold">AI Recommendation</span>
                </div>
                <p className="text-[11px] text-emerald-300/70 mt-1.5 leading-relaxed">Use Avalanche strategy. Pay off Credit Card first → saves $4,200 in total interest.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          AI STRATEGY
      ═══════════════════════════════════════════════════════ */}
      <section id="strategy" className="py-20 lg:py-28 px-5 border-t border-white/[0.04]" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-[0.15em] mb-3 block">AI Strategy</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>{s.strat_title}</h2>
            <p className="text-slate-400 leading-relaxed">{s.strat_sub}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {[
              {
                title: s.strat_snowball_title, sub: s.strat_snowball_sub, desc: s.strat_snowball_desc,
                pros: s.strat_snowball_pros,
                color: 'from-amber-500 to-orange-600', glow: 'amber', icon: Flame,
                example: ['Credit Card: $2,000', 'Personal Loan: $8,500', 'Car Loan: $15,000'],
                saved: '$2,100',
              },
              {
                title: s.strat_avalanche_title, sub: s.strat_avalanche_sub, desc: s.strat_avalanche_desc,
                pros: s.strat_avalanche_pros,
                color: 'from-blue-500 to-indigo-600', glow: 'blue', icon: TrendingDown,
                example: ['Credit Card 24%: $2,000', 'Personal 18%: $8,500', 'Car Loan 8%: $15,000'],
                saved: '$4,600',
              },
            ].map((strat, i) => (
                <div key={i} className={`glass rounded-3xl p-7 lg:p-9 transition-all duration-700 opacity-100`}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${strat.color} flex items-center justify-center shadow-lg`}>
                      <strat.icon size={22} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-white" style={{ fontFamily: "'Sora', sans-serif" }}>{strat.title}</h3>
                      <p className={`text-xs font-bold bg-gradient-to-r ${strat.color} bg-clip-text text-transparent`}>{strat.sub}</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">{strat.desc}</p>
                  <div className="space-y-2 mb-6">
                    {strat.pros.map((p, j) => (
                      <div key={j} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-300">{p}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">{s.strat_example_label}</p>
                    <div className="space-y-2">
                      {strat.example.map((d, j) => (
                        <div key={j} className="flex items-center gap-2.5 text-xs text-slate-400">
                          <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${strat.color} text-white flex items-center justify-center text-[9px] font-black flex-shrink-0`}>{j+1}</span>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/[0.05] text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">{s.strat_saved_label}</p>
                      <p className={`text-2xl font-black bg-gradient-to-r ${strat.color} bg-clip-text text-transparent`}>{strat.saved}</p>
                    </div>
                  </div>
                </div>
            ))}
          </div>

          {/* AI badge */}
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3.5 glass rounded-2xl border border-emerald-500/20">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <BrainCircuit size={18} className="text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-white">Paydone AI</p>
                <p className="text-[11px] text-slate-400">Analyzes your profile and auto-selects the best strategy</p>
              </div>
              <ArrowRight size={16} className="text-emerald-400" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 px-5 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-[0.15em] mb-3 block">Testimonials</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>{s.test_title}</h2>
            <p className="text-slate-400">{s.test_sub}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.testimonials.map((t, i) => <TestimonialCard key={i} t={t} delay={i*70} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          PRICING
      ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 lg:py-28 px-5 border-t border-white/[0.04]" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-[0.15em] mb-3 block">Pricing</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>{s.price_title}</h2>
            <p className="text-slate-400">{s.price_sub}</p>
          </div>

          {packagesLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 size={22} className="animate-spin" /><span>{s.price_loading}</span>
            </div>
          ) : packages.length === 0 ? (
            /* Default fallback packages */
            <div className="grid lg:grid-cols-2 gap-5 max-w-3xl mx-auto">
              {[
                { name: 'Free', price: 0, badge: s.price_free_badge, features: ['Unlimited debt tracking','AI Strategist (10/day)','Budget allocation','Payment calendar','Offline mode'], highlight: false },
                { name: 'Pro', price: activeLang === 'id' ? 99000 : activeLang === 'zh' ? 49 : activeLang === 'hi' ? 299 : activeLang === 'ru' ? 699 : activeLang === 'ar' ? 35 : 9, badge: s.price_premium_badge, features: ['Everything in Free','Unlimited AI queries','Family mode (5 members)','Priority support','Cloud sync across devices','Advanced projections'], highlight: true },
              ].map((pkg, i) => (
                  <div key={i} className={`relative glass rounded-3xl p-7 lg:p-9 transition-all duration-500 hover:-translate-y-1 ${pkg.highlight ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : ''}`}>
                    {pkg.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-[#060b12] text-xs font-black rounded-full shadow-lg">
                        {pkg.badge}
                      </div>
                    )}
                    <h3 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>{pkg.name}</h3>
                    <div className="flex items-end gap-1 mb-6">
                      {pkg.price === 0 ? (
                        <span className="text-4xl font-black text-emerald-400">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-white">
                            {activeLang === 'id' ? `Rp${(pkg.price/1000).toFixed(0)}K` :
                             activeLang === 'zh' ? `¥${pkg.price}` :
                             activeLang === 'hi' ? `₹${pkg.price}` :
                             activeLang === 'ru' ? `₽${pkg.price}` :
                             activeLang === 'ar' ? `﷼${pkg.price}` :
                             activeLang === 'es' || activeLang === 'fr' ? `€${pkg.price}` :
                             `$${pkg.price}`}
                          </span>
                          <span className="text-slate-500 pb-1 text-sm">{s.price_per_month}</span>
                        </>
                      )}
                    </div>
                    <div className="space-y-3 mb-7">
                      {pkg.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-300">{f}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/register" className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition ${pkg.highlight ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-[#060b12] hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20' : 'border border-white/10 text-slate-200 hover:bg-white/5'}`}>
                      {pkg.price === 0 ? s.price_cta_free : s.price_cta_paid}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
              ))}
            </div>
          ) : (
            <div className={`grid gap-5 ${packages.length === 1 ? 'max-w-md mx-auto' : packages.length === 2 ? 'lg:grid-cols-2 max-w-3xl mx-auto' : 'lg:grid-cols-3'}`}>
              {packages.map((pkg, i) => {
                const featured = pkg.price > 0 && packages.length > 1 && i === 1;
                const fEntries = Object.entries(pkg.features).filter(([,v]) => v);
                return (
                  <div key={pkg.id} className={`relative glass rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1 ${featured ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : ''}`}>
                    {featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-[#060b12] text-xs font-black rounded-full shadow-lg">{s.price_premium_badge}</div>
                    )}
                    {pkg.is_default_free && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white/10 text-white text-xs font-bold rounded-full">{s.price_free_badge}</div>
                    )}
                    <h3 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>{pkg.name}</h3>
                    <div className="flex items-end gap-1 mb-2">
                      {pkg.price === 0 ? (
                        <span className="text-4xl font-black text-emerald-400">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-white">{formatCurrency(pkg.price)}</span>
                          <span className="text-slate-500 pb-1 text-sm">{s.price_per_month}</span>
                        </>
                      )}
                    </div>
                    {pkg.description && <p className="text-slate-500 text-xs mb-5">{pkg.description}</p>}
                    <div className="flex items-center gap-1.5 mb-5 text-xs text-slate-400">
                      <BrainCircuit size={13} className="text-emerald-400" />
                      <span>{pkg.ai_limit} {s.price_ai_limit}</span>
                    </div>
                    <div className="space-y-2.5 mb-7">
                      {fEntries.slice(0, 8).map(([k]) => (
                        <div key={k} className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-300 capitalize">{k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                    <Link to={pkg.is_default_free ? '/register' : '/register?plan=' + pkg.id} className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition ${featured ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-[#060b12] shadow-lg shadow-emerald-500/20' : 'border border-white/10 text-slate-200 hover:bg-white/5'}`}>
                      {pkg.is_default_free ? s.price_cta_free : s.price_cta_paid}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-20 lg:py-28 px-5 border-t border-white/[0.04]" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-[0.15em] mb-3 block">FAQ</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>{s.faq_title}</h2>
            <p className="text-slate-400">{s.faq_sub}</p>
          </div>
          <div className="glass rounded-3xl p-6 md:p-8">
            {s.faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} open={openFAQ === i} onClick={() => setOpenFAQ(openFAQ === i ? null : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          NEWSLETTER
      ═══════════════════════════════════════════════════════ */}
      <section className="py-16 px-5 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto text-center">
          <Mail size={28} className="text-emerald-400 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>{s.news_title}</h3>
          <p className="text-slate-400 text-sm mb-7">{s.news_sub}</p>
          {leadSuccess ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 font-semibold">
              <CheckCircle2 size={18} />
              {s.news_success}
            </div>
          ) : (
            <form onSubmit={handleLead} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)}
                placeholder={s.news_placeholder}
                className="flex-1 px-5 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 transition"
              />
              <button type="submit" disabled={leadLoading} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-[#060b12] font-bold text-sm rounded-xl hover:from-emerald-400 hover:to-teal-500 transition shadow-lg disabled:opacity-60 flex items-center gap-2">
                {leadLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {s.news_cta}
              </button>
            </form>
          )}
          {leadError && <p className="text-rose-400 text-xs mt-3">{leadError}</p>}
          <p className="text-slate-600 text-xs mt-4">{s.news_no_spam}</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-5 border-t border-white/[0.04] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.04] to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none glow-pulse" />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 mb-8 shadow-2xl shadow-emerald-500/30">
            <Wallet size={28} className="text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-5 leading-[1.1]" style={{ fontFamily: "'Sora', sans-serif" }}>
            {s.final_title}
          </h2>
          <p className="text-slate-400 text-base mb-9 max-w-xl mx-auto leading-relaxed">{s.final_sub}</p>
          <Link to="/register" className="inline-flex items-center gap-3 px-9 py-4 bg-gradient-to-r from-emerald-400 to-teal-600 hover:from-emerald-300 hover:to-teal-500 text-[#060b12] font-black text-base rounded-2xl transition-all shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.03] active:scale-[0.98]">
            <Zap size={20} />
            {s.final_cta}
          </Link>
          <div className="flex items-center justify-center gap-6 mt-9 text-xs text-slate-600">
            <div className="flex items-center gap-1.5"><Shield size={13} className="text-emerald-700" /><span>Bank-grade Security</span></div>
            <div className="flex items-center gap-1.5"><Lock size={13} className="text-emerald-700" /><span>End-to-End Encrypted</span></div>
            <div className="flex items-center gap-1.5"><Zap size={13} className="text-emerald-700" /><span>Free Forever</span></div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer className="py-10 px-5 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Wallet size={15} className="text-white" />
            </div>
            <div>
              <span className="font-black text-white text-sm" style={{ fontFamily: "'Sora', sans-serif" }}>{appName}</span>
              <p className="text-[11px] text-slate-600">{s.footer_tagline}</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">{s.footer_links}</p>
          <p className="text-xs text-slate-700">{s.footer_rights}</p>
        </div>
      </footer>
    </div>
  );
}
