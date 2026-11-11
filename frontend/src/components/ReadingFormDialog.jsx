import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { api, ApiError } from '../api.js';
import { todayString } from '../dates.js';

const MIN = 40;
const MAX = 600;

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
 * Server-side rule errors (duplicate slot, max 4 per day) are shown under the matching field.
 */
export default function ReadingFormDialog({ open, reading, defaultDate, slots, onClose, onSaved }) {
  const isEdit = Boolean(reading);
  const [form, setForm] = useState({ date: defaultDate, slot: '', value: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Start fresh every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setForm(
      reading
        ? { date: reading.date, slot: reading.slot, value: String(reading.value) }
        : { date: defaultDate, slot: '', value: '' }
    );
    setErrors({});
    setFormError('');
  }, [open, reading, defaultDate]);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    const body = { date: form.date, slot: form.slot, value: form.value.trim() };
    setSaving(true);
    try {
      if (isEdit) await api.updateReading(reading.id, body);
      else await api.createReading(body);
      onSaved(form.date);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors(err.fieldErrors || {});
      if (!err.fieldErrors) setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>{isEdit ? 'Edit reading' : 'Add reading'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={setField('date')}
            error={Boolean(errors.date)}
            helperText={errors.date}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayString() } }}
            fullWidth
          />

          <TextField
            select
            label="Time slot"
            value={form.slot}
            onChange={setField('slot')}
            error={Boolean(errors.slot)}
            helperText={errors.slot}
            fullWidth
          >
            {slots.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Glucose value (mg/dl)"
            value={form.value}
            onChange={setField('value')}
            error={Boolean(errors.value)}
            helperText={errors.value || `Whole number from ${MIN} to ${MAX}.`}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            autoFocus
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
