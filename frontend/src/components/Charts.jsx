import { Box, Typography } from '@mui/material';
import { TONES, toneFor } from '../status.js';

const W = 720;
const H = 270;
const X0 = 56;
const X1 = 704;
const Y0 = 18;
const Y1 = 232;

const round = (n) => Math.round(n * 10) / 10;

function Frame({ vmax, target, children }) {
  const yOf = (v) => Y1 - (v / vmax) * (Y1 - Y0);
  const ticks = [0, 1, 2, 3, 4].map((i) => (vmax / 4) * i);
  return (
    <>
      <rect x={X0} y={yOf(target.high)} width={X1 - X0} height={yOf(target.low) - yOf(target.high)} fill="#E3F3F0" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={yOf(v)} y2={yOf(v)} stroke="#E1E7E4" />
          <text x={X0 - 8} y={yOf(v) + 4} textAnchor="end" fontSize="12" fill="#55645F" fontFamily="Inter, sans-serif">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {children(yOf)}
    </>
  );
}

const vmaxFor = (values, target) => Math.max(240, Math.ceil(Math.max(target.high, ...values) / 60) * 60);

/** Bars of average values; each bar is coloured by how it compares with the target range. */
export function BarChart({ points, target, ariaLabel }) {
  const vmax = vmaxFor(points.map((p) => p.value), target);
  const n = points.length;
  const slot = (X1 - X0) / n;
  const barW = Math.min(56, slot * 0.62);
  const labelEvery = Math.max(1, Math.ceil(n / 14));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      <Frame vmax={vmax} target={target}>
        {(yOf) =>
          points.map((p, i) => {
            const cx = X0 + slot * i + slot / 2;
            const top = yOf(p.value);
            return (
              <g key={`${p.label}-${i}`}>
                <rect x={round(cx - barW / 2)} y={round(top)} width={round(barW)} height={round(Y1 - top)} rx="3" fill={toneFor(p.value, target).bar} />
                {n <= 12 && (
                  <text x={round(cx)} y={round(top - 6)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#14211F" fontFamily="Inter, sans-serif">
                    {Math.round(p.value)}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={round(cx)} y={H - 12} textAnchor="middle" fontSize="12" fill="#55645F" fontFamily="Inter, sans-serif">
                    {p.label}
                  </text>
                )}
              </g>
            );
          })
        }
      </Frame>
    </svg>
  );
}

/** A line over time. Days with no reading (value null) leave a gap instead of a fake zero. */
export function LineChart({ points, target, ariaLabel }) {
  const values = points.filter((p) => p.value !== null).map((p) => p.value);
  const vmax = vmaxFor(values, target);
  const n = points.length;
  const xOf = (i) => X0 + 12 + (i * (X1 - X0 - 24)) / Math.max(1, n - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      <Frame vmax={vmax} target={target}>
        {(yOf) => {
          // Split into runs of consecutive days that have a value.
          const runs = [];
          let run = [];
          points.forEach((p, i) => {
            if (p.value === null) {
              if (run.length) runs.push(run);
              run = [];
            } else run.push({ x: xOf(i), y: yOf(p.value) });
          });
          if (run.length) runs.push(run);

          return (
            <>
              {runs.map((r, i) =>
                r.length > 1 ? (
                  <polyline key={i} points={r.map((d) => `${round(d.x)},${round(d.y)}`).join(' ')} fill="none" stroke={TONES.ok.bar} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                ) : null
              )}
              {points.map((p, i) => (
                <g key={p.label + i}>
                  {p.value !== null && <circle cx={round(xOf(i))} cy={round(yOf(p.value))} r="4.5" fill="#FFFFFF" stroke={TONES.ok.bar} strokeWidth="2.2" />}
                  {i % 2 === 0 && (
                    <text x={round(xOf(i))} y={H - 12} textAnchor="middle" fontSize="12" fill="#55645F" fontFamily="Inter, sans-serif">
                      {p.label}
                    </text>
                  )}
                </g>
              ))}
            </>
          );
        }}
      </Frame>
    </svg>
  );
}

/** The colour key under a chart, so colour is never the only way to read it. */
export function ChartLegend({ target }) {
  const items = [
    [TONES.ok.bar, `In range (${target.low}–${target.high})`],
    [TONES.high.bar, `Above ${target.high}`],
    [TONES.low.bar, `Below ${target.low}`],
  ];
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {items.map(([color, text]) => (
        <Box key={text} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color }} />
          <Typography variant="caption" color="text.secondary">
            {text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
