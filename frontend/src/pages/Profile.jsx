import { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Button, MenuItem, Paper, Skeleton, TextField, Typography } from '@mui/material';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { todayString } from '../dates.js';
import PageHeader from '../components/PageHeader.jsx';
import { initialsOf } from '../components/Layout.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELDS = [
  'name', 'email', 'phone', 'dateOfBirth', 'sex', 'heightCm', 'weightKg',
  'diabetesType', 'diagnosedYear', 'medication', 'targetLow', 'targetHigh',
  'doctorName', 'doctorPhone', 'emergencyContact',
];

const toForm = (profile) => Object.fromEntries(FIELDS.map((f) => [f, profile[f] === null || profile[f] === undefined ? '' : String(profile[f])]));

function Fact({ label, value }) {
  return (
    <Box sx={{ px: 2.25, py: 1.5, borderRadius: '12px', bgcolor: '#F7FAF9' }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="h6" component="div">
        {value}
      </Typography>
    </Box>
  );
}

export default function Profile() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getProfile()
      .then(({ profile }) => {
        if (cancelled) return;
        setProfile(profile);
        setForm(toForm(profile));
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setSaved(false);
  };

  // Shared props for every text field: label, value, change handler and the error message.
  const field = (name, label, extra = {}) => ({
    label,
    value: form?.[name] ?? '',
    onChange: setField(name),
    error: Boolean(errors[name]),
    helperText: errors[name] || extra.helper || ' ',
    fullWidth: true,
    ...extra.props,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!form.name.trim()) found.name = 'Please enter your name.';
    if (!form.email.trim()) found.email = 'Please enter your email.';
    else if (!EMAIL_RE.test(form.email.trim())) found.email = 'Please enter a valid email address.';
    if (form.dateOfBirth && form.dateOfBirth > todayString()) found.dateOfBirth = 'Date of birth cannot be in the future.';
    setErrors(found);
    setFormError('');
    setSaved(false);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const { profile: next } = await api.updateProfile(form);
      setProfile(next);
      setForm(toForm(next));
      updateUser(next); // so the sidebar and target range update straight away
      setSaved(true);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors(err.fieldErrors || {});
      if (!err.fieldErrors || Object.keys(err.fieldErrors).length === 0) setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  if (!form) {
    return (
      <>
        <PageHeader title="Profile" />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={420} />
      </>
    );
  }

  const textInput = { slotProps: { htmlInput: { inputMode: 'numeric' } } };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 3 }}>
      <PageHeader title="Profile" subtitle="Your details appear on exported reports and help your doctor read them." />

      {saved && <Alert severity="success">Profile saved.</Alert>}
      {formError && <Alert severity="error">{formError}</Alert>}

      <Paper variant="outlined" component="section" aria-label="Summary" sx={{ p: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2.5 }}>
        <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.light', color: 'primary.dark', fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 26 }}>
          {initialsOf(profile.name)}
        </Avatar>
        <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
          <Typography variant="h5" component="h2" noWrap>
            {profile.name}
          </Typography>
          <Typography color="text.secondary" noWrap>
            {profile.email}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Fact label="Age" value={profile.age !== null ? `${profile.age} yrs` : '–'} />
          <Fact label="BMI" value={profile.bmi ?? '–'} />
          <Fact label="Target range" value={`${profile.targetLow}–${profile.targetHigh}`} />
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Paper variant="outlined" component="section" aria-labelledby="personal-heading" sx={{ p: 3, display: 'grid', gap: 1 }}>
          <Typography id="personal-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
            Personal details
          </Typography>
          <Box sx={{ display: 'grid', gap: '8px 16px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField {...field('name', 'Full name', { props: { autoComplete: 'name' } })} />
            </Box>
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField {...field('email', 'Email', { props: { type: 'email', autoComplete: 'email' } })} />
            </Box>
            <TextField {...field('phone', 'Phone', { props: { type: 'tel', autoComplete: 'tel' } })} />
            <TextField {...field('dateOfBirth', 'Date of birth', { props: { type: 'date', slotProps: { inputLabel: { shrink: true }, htmlInput: { max: todayString() } } } })} />
            <TextField {...field('sex', 'Sex', { props: { select: true } })}>
              <MenuItem value="">Prefer not to say</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
            <Box />
            <TextField {...field('heightCm', 'Height (cm)', textInput)} />
            <TextField {...field('weightKg', 'Weight (kg)', textInput)} />
          </Box>
        </Paper>

        <Paper variant="outlined" component="section" aria-labelledby="medical-heading" sx={{ p: 3, display: 'grid', gap: 1 }}>
          <Typography id="medical-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
            Medical details
          </Typography>
          <Box sx={{ display: 'grid', gap: '8px 16px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField {...field('diabetesType', 'Diabetes type', { props: { select: true } })}>
              <MenuItem value="">Not set</MenuItem>
              <MenuItem value="Type 1">Type 1</MenuItem>
              <MenuItem value="Type 2">Type 2</MenuItem>
              <MenuItem value="Gestational">Gestational</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
            <TextField {...field('diagnosedYear', 'Year diagnosed', textInput)} />
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField {...field('medication', 'Medication')} />
            </Box>
            <TextField {...field('targetLow', 'Target low (mg/dl)', { ...textInput, helper: 'Default 70' })} />
            <TextField {...field('targetHigh', 'Target high (mg/dl)', { ...textInput, helper: 'Default 180' })} />
            <TextField {...field('doctorName', 'Doctor')} />
            <TextField {...field('doctorPhone', 'Doctor phone', { props: { type: 'tel' } })} />
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField {...field('emergencyContact', 'Emergency contact')} />
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box>
        <Button type="submit" variant="contained" size="large" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </Box>
    </Box>
  );
}
