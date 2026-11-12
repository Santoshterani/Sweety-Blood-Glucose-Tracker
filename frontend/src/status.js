// How a reading compares with the patient's target range.
// Colour is never the only signal: every status also has a text label.
export const TONES = {
  ok: { label: 'In range', bg: '#E3F3F0', fg: '#0B5A52', bar: '#0B6E64' },
  high: { label: 'High', bg: '#FDEBDD', fg: '#8F3A0A', bar: '#C2570C' },
  low: { label: 'Low', bg: '#E8E6FA', fg: '#3F3598', bar: '#5B4FD0' },
};

export function toneFor(value, target) {
  if (value > target.high) return TONES.high;
  if (value < target.low) return TONES.low;
  return TONES.ok;
}

export const targetOf = (user) => ({ low: user?.targetLow ?? 70, high: user?.targetHigh ?? 180 });
