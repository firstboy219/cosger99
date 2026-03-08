/**
 * LazyCharts.tsx — v50.70
 * Wrapper for recharts that loads via dynamic import() to prevent d3 TDZ bundle errors.
 * Drop-in replacement: just change 'recharts' → '../components/LazyCharts'
 * All recharts API preserved. Components show loader placeholder until lib is ready.
 */
import React, { useState, useEffect } from 'react';

// ─── DYNAMIC LOADER ──────────────────────────────────────────────────────────
let _lib: any = null;
let _promise: Promise<any> | null = null;

const loadRecharts = () => {
  if (_lib) return Promise.resolve(_lib);
  if (!_promise) {
    _promise = import('recharts').then(mod => { _lib = mod; return mod; }).catch(() => null);
  }
  return _promise;
};

function useRecharts() {
  const [lib, setLib] = useState<any>(_lib);
  useEffect(() => {
    if (!lib) loadRecharts().then(m => { if (m) setLib(m); });
  }, []);
  return lib;
}

const Placeholder: React.FC<{ height?: any }> = ({ height = 200 }) => (
  <div style={{ height: typeof height === 'number' ? height : 200 }}
       className="flex items-center justify-center bg-slate-50 rounded-xl animate-pulse">
    <span className="text-xs text-slate-300">Loading chart...</span>
  </div>
);

// ─── CHART CONTAINERS ─────────────────────────────────────────────────────────
export const ResponsiveContainer: React.FC<{width?:any;height?:any;children?:React.ReactNode;[k:string]:any}> =
  ({ width='100%', height=300, children, ...rest }) => {
    const lib = useRecharts();
    if (!lib) return <Placeholder height={height} />;
    return <lib.ResponsiveContainer width={width} height={height} {...rest}>{children}</lib.ResponsiveContainer>;
  };

// ─── CHART TYPES ──────────────────────────────────────────────────────────────
const makeChart = (name: string) => {
  const C: React.FC<any> = (props) => {
    const lib = useRecharts();
    if (!lib) return null;
    const Tag = lib[name];
    return Tag ? <Tag {...props} /> : null;
  };
  C.displayName = name;
  return C;
};

export const AreaChart    = makeChart('AreaChart');
export const LineChart    = makeChart('LineChart');
export const BarChart     = makeChart('BarChart');
export const PieChart     = makeChart('PieChart');
export const RadialBarChart = makeChart('RadialBarChart');

// ─── CHART ELEMENTS ───────────────────────────────────────────────────────────
export const Area         = makeChart('Area');
export const Line         = makeChart('Line');
export const Bar          = makeChart('Bar');
export const Pie          = makeChart('Pie');
export const RadialBar    = makeChart('RadialBar');
export const Cell         = makeChart('Cell');
export const XAxis        = makeChart('XAxis');
export const YAxis        = makeChart('YAxis');
export const CartesianGrid = makeChart('CartesianGrid');
export const Tooltip      = makeChart('Tooltip');
export const Legend       = makeChart('Legend');
export const ReferenceLine = makeChart('ReferenceLine');
