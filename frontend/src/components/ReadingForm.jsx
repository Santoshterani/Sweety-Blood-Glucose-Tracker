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
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { roomyFields } from '../theme.js';
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
 * variant "wide" is the Add reading card: date, time slots, value and Save in one row, with the slots that are
 * already logged on that date greyed out. variant "stacked" is the narrow form used in the edit dialog.
 * Rules only the server can check (one per slot, max 4 a day) come back as field errors and are shown under the matching field.
 */
export default function ReadingForm({ slots, reading = null, defaultDate, onSaved, onCancel, onValueError, variant = 'stacked' }) {
  const wide = variant === 'wide';
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
        if (!cancelled) setTaken(data.filter((r) => r.id !== reading?.id).map((r) => ({ slot: r.slot, value: r.value })));
      })
      .catch(() => {
        if (!cancelled) setTaken([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.date, reading?.id, refresh]);

  const takenSlots = taken.map((t) => t.slot);

  // If the chosen slot turns out to be logged already on the newly picked date, un-pick it.
  useEffect(() => {
    setForm((f) => (f.slot && takenSlots.includes(f.slot) ? { ...f, slot: '' } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken]);

  const setField = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setSavedText('');
  };

  const number = /^\d+$/.test(form.value.trim()) ? Number(form.value) : null;
  const tone = number !== null && number >= MIN && number <= MAX ? toneFor(number, target) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    const hasEnteredInvalidValue = Boolean(found.value && form.value.trim());
    const visibleErrors = { ...found };
    if (hasEnteredInvalidValue) delete visibleErrors.value;
    setErrors(visibleErrors);
    setFormError('');
    setSavedText('');
    if (Object.keys(found).length) {
      if (hasEnteredInvalidValue) onValueError?.(found.value);
      return;
    }

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

  if (wide) {
    const loggedToday = form.date === todayString();
    const takenLabels = slots.filter((sl) => takenSlots.includes(sl.value)).map((sl) => sl.label.replace(' (fasting)', ''));
    const labelSx = { fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 1, p: 0, '&.Mui-focused': { color: 'text.primary' } };

    return (
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2.5, ...roomyFields }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
          <Box>
            <Typography id="add-heading" variant="h5" component="h2">
              Add reading
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Up to 4 a day, one per time slot.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 14, color: 'secondary.main' }}>
            <Box aria-hidden="true" sx={{ display: 'flex', gap: '5px' }}>
              {[0, 1, 2, 3].map((i) => (
                <Box key={i} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: i < taken.length ? 'primary.main' : '#CBD5D1' }} />
              ))}
            </Box>
            <span>
              <strong>{taken.length} of 4</strong> logged {loggedToday ? 'today' : `for ${formatDate(form.date)}`}
            </span>
          </Box>
        </Box>

        {savedText && <Alert severity="success">Saved: {savedText}</Alert>}
        {formError && <Alert severity="error">{formError}</Alert>}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2.5 }}>
          <TextField
            label="Date"
            required
            type="date"
            value={form.date}
            onChange={setField('date')}
            error={Boolean(errors.date)}
            helperText={errors.date || null}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayString() } }}
            sx={{ flex: { xs: '1 1 100%', sm: '0 0 200px' } }}
          />

          <FormControl component="fieldset" error={Boolean(errors.slot)} variant="standard" sx={{ flex: { xs: '1 1 100%', md: '1 1 520px' }, minWidth: 0 }}>
            <FormLabel component="legend" required sx={labelSx}>
              Time slot
            </FormLabel>
            <RadioGroup row name="slot" value={form.slot} onChange={setField('slot')} sx={{ gap: 1.25, flexWrap: 'wrap' }}>
              {slots.map((sl) => {
                const logged = taken.find((t) => t.slot === sl.value);
                const checked = form.slot === sl.value;
                return (
                  <Box
                    key={sl.value}
                    component="label"
                    sx={{
                      position: 'relative',
                      flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 140px' },
                      minHeight: 56,
                      boxSizing: 'border-box',
                      px: checked ? '13px' : 2,
                      py: checked ? '7px' : 1,
                      borderRadius: '10px',
                      border: checked ? '2px solid' : '1px solid',
                      borderColor: logged ? '#DCE4E1' : checked ? 'primary.main' : '#7C8F89',
                      bgcolor: logged ? '#F1F5F4' : checked ? 'primary.light' : 'background.paper',
                      color: logged ? 'text.secondary' : checked ? '#0B4F48' : 'text.primary',
                      cursor: logged ? 'not-allowed' : 'pointer',
                      '&:has(input:focus-visible)': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                    }}
                  >
                    <Radio
                      value={sl.value}
                      disabled={Boolean(logged)}
                      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', m: 0, p: 0, opacity: 0, cursor: 'inherit' }}
                      slotProps={{ input: { 'aria-label': logged ? `${sl.label}, already logged: ${logged.value} mg/dl` : sl.label } }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 14, fontWeight: checked ? 700 : 600 }}>
                      {logged && <CheckRoundedIcon aria-hidden="true" sx={{ fontSize: 16, color: 'primary.main' }} />}
                      {sl.label.replace(' (fasting)', '')}
                    </Box>
                    <Box sx={{ fontSize: 12, mt: 0.25, color: checked ? 'inherit' : 'text.secondary' }}>
                      {logged ? `Logged · ${logged.value} mg/dl` : HINTS[sl.value]}
                    </Box>
                  </Box>
                );
              })}
            </RadioGroup>
            <FormHelperText>{errors.slot || null}</FormHelperText>
          </FormControl>

          <TextField
            label="Glucose value"
            required
            value={form.value}
            onChange={setField('value')}
            error={Boolean(errors.value)}
            helperText={
              errors.value ||
              (tone ? (
                <Box component="span" sx={{ display: 'inline-block', px: 1.25, py: 0.25, borderRadius: '12px', bgcolor: tone.bg, color: tone.fg, fontWeight: 600, fontSize: 12.5 }}>
                  {tone.label}
                </Box>
              ) : (
                `Whole number from ${MIN} to ${MAX}.`
              ))
            }
            placeholder="e.g. 110"
            slotProps={{
              htmlInput: { inputMode: 'numeric', style: { fontWeight: 600 } },
              input: { endAdornment: <InputAdornment position="end">mg/dl</InputAdornment> },
            }}
            sx={{ flex: { xs: '1 1 100%', sm: '0 0 190px' } }}
          />

          <Button type="submit" variant="contained" disabled={saving} sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' }, mt: { xs: 0, sm: '30px' }, px: 4 }}>
            {saving ? 'Saving…' : 'Save reading'}
          </Button>
        </Box>

        {takenLabels.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} aria-live="polite">
            <InfoOutlinedIcon aria-hidden="true" sx={{ fontSize: 16 }} />
            {takenLabels.length === slots.length
              ? 'All 4 slots are logged for this date. Choose another date.'
              : `${takenLabels.join(', ')} ${takenLabels.length > 1 ? 'are' : 'is'} already logged for this date. Pick another slot or change the date.`}
          </Typography>
        )}
      </Box>
    );
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
                    {takenSlots.includes(s.value) ? 'Already logged on this date' : HINTS[s.value]}
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
