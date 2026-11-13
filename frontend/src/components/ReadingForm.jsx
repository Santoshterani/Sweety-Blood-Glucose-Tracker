import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  FormLabel,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatDate, todayString } from '../dates.js';
import { targetOf, toneFor } from '../status.js';

const MIN = 40;
const MAX = 600;

const HINTS = {
  morning: 'Before eating',
  after_breakfast: '1–2 hours after',
  after_lunch: '1–2 hours after',
  after_dinner: '1–2 hours after',
};

/** Same rules as the server, so people get instant feedback. The server stays the final judge. */
function validate({ value, date, slot }) {
  const errors = {};
  const text = String(value).trim();
  if (text === '') errors.value = 'Please enter a glucose value.';
  else if (!/^-?\d+$/.test(text) || Number(text) < MIN || Number(text) > MAX) {
    errors.value = `Value must be between ${MIN} and ${MAX} mg/dl.`;
  }
  if (!date) errors.date = 'Please select a date.';
  else if (date > todayString()) errors.date = 'Date cannot be in the future.';
  if (!slot) errors.slot = 'Please select a time slot.';
  return errors;
}

/**
 * Add a reading (reading = null) or edit one (reading = {...}).
 * Rules only the server can check (one per slot, max 4 a day) come back as field errors and are shown under the matching field.
 */
export default function ReadingForm({ slots, reading = null, defaultDate, onSaved, onCancel }) {
  const { user } = useAuth();
  const target = targetOf(user);
  const isEdit = Boolean(reading);

  const [form, setForm] = useState({
    date: reading?.date ?? defaultDate ?? todayString(),
    slot: reading?.slot ?? '',
    value: reading ? String(reading.value) : '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState('');
  const [taken, setTaken] = useState([]);
  const [refresh, setRefresh] = useState(0);

  // Which slots already have a reading on the chosen date (a hint only; the server enforces the rules).
  useEffect(() => {
    if (!form.date || form.date > todayString()) {
      setTaken([]);
      return undefined;
    }
    let cancelled = false;
    api
      .listReadings({ date: form.date, limit: 100 })
      .then(({ data }) => {
        if (!cancelled) setTaken(data.filter((r) => r.id !== reading?.id).map((r) => r.slot));
      })
      .catch(() => {
        if (!cancelled) setTaken([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.date, reading?.id, refresh]);

  const setField = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setSavedText('');
  };

  const number = /^\d+$/.test(form.value.trim()) ? Number(form.value) : null;
  const tone = number !== null && number >= MIN && number <= MAX ? toneFor(number, target) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError('');
    setSavedText('');
    if (Object.keys(found).length) return;

    const body = { date: form.date, slot: form.slot, value: form.value.trim() };
    setSaving(true);
    try {
      const { reading: saved } = isEdit ? await api.updateReading(reading.id, body) : await api.createReading(body);
      if (!isEdit) {
        setForm((f) => ({ ...f, slot: '', value: '' }));
        setSavedText(`${saved.value} mg/dl, ${saved.slotLabel}, ${formatDate(saved.date)}`);
        setRefresh((n) => n + 1);
      }
      onSaved?.(saved);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors(err.fieldErrors || {});
      if (!err.fieldErrors || Object.keys(err.fieldErrors).length === 0) setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2.5 }}>
      {savedText && <Alert severity="success">Saved: {savedText}</Alert>}
      {formError && <Alert severity="error">{formError}</Alert>}

      <TextField
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={setField('date')}
        error={Boolean(errors.date)}
        helperText={errors.date || ' '}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayString() } }}
        fullWidth
      />

      <FormControl component="fieldset" error={Boolean(errors.slot)} variant="standard">
        <FormLabel component="legend" required sx={{ color: 'text.primary', fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', mb: 1, textTransform: 'uppercase' }}>
          Time slot
        </FormLabel>
        <RadioGroup name="slot" value={form.slot} onChange={setField('slot')} sx={{ display: 'grid', gap: 1 }}>
          {slots.map((s) => {
            const checked = form.slot === s.value;
            return (
              <Paper
                key={s.value}
                component="label"
                variant="outlined"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  minHeight: 52,
                  px: 1,
                  py: 0.5,
                  cursor: 'pointer',
                  borderRadius: '12px',
                  bgcolor: checked ? 'primary.light' : 'background.paper',
                  borderColor: checked ? 'primary.main' : '#84928C',
                  borderWidth: checked ? 2 : 1,
                }}
              >
                <Radio value={s.value} />
                <Box>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{s.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {taken.includes(s.value) ? 'Already logged on this date' : HINTS[s.value]}
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </RadioGroup>
        <FormHelperText sx={{ minHeight: 20 }}>{errors.slot || ' '}</FormHelperText>
      </FormControl>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            label="Glucose value"
            required
            value={form.value}
            onChange={setField('value')}
            error={Boolean(errors.value)}
            helperText={errors.value || `Whole number from ${MIN} to ${MAX}.`}
            placeholder="e.g. 120"
            slotProps={{
              htmlInput: { inputMode: 'numeric', style: { fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 22 } },
              input: { endAdornment: <InputAdornment position="end">mg/dl</InputAdornment> },
            }}
            sx={{ flex: '1 1 180px' }}
          />
          {tone && <Chip label={tone.label} sx={{ mt: 1.25, bgcolor: tone.bg, color: tone.fg, fontWeight: 600 }} />}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button type="submit" variant="contained" size="large" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save reading'}
        </Button>
        {onCancel && (
          <Button onClick={onCancel} color="secondary" disabled={saving}>
            Cancel
          </Button>
        )}
      </Box>
    </Box>
  );
}
