import { Chip } from '@mui/material';
import { toneFor } from '../status.js';

/** "In range" / "High" / "Low" pill for one value. */
export default function StatusChip({ value, target, size = 'small' }) {
  const tone = toneFor(value, target);
  return <Chip size={size} label={tone.label} sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 600 }} />;
}
