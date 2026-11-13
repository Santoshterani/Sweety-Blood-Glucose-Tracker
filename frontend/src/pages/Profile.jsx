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

function ProfileField({ name, label, form, errors, onChange, required = false, helperText, textFieldProps = {}, children }) {
  const inputId = `profile-${name}`;
  const labelId = `${inputId}-label`;
  const slotProps = {
    ...textFieldProps.slotProps,
    ...(textFieldProps.select
      ? { select: { ...textFieldProps.slotProps?.select, 'aria-labelledby': labelId } }
      : {}),
  };

  return (
    <Box sx={{ minWidth: 0, display: 'grid', alignContent: 'start', gap: 0.5 }}>
      <Typography
        id={labelId}
        component="label"
        htmlFor={inputId}
        sx={{
          color: '#435779',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.06em',
          lineHeight: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}{required ? ' *' : ''}
      </Typography>
      <TextField
        {...textFieldProps}
        id={inputId}
        value={form[name] ?? ''}
        onChange={onChange}
        error={Boolean(errors[name])}
        helperText={errors[name] || helperText || null}
        required={required}
        fullWidth
        size="small"
        slotProps={slotProps}
        sx={{
          '& .MuiOutlinedInput-root': { borderRadius: '6px', bgcolor: '#fff', fontSize: 12 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D9E1EF' },
          '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9BAAC3' },
        }}
      >
        {children}
      </TextField>
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

  const field = (name, label, { required = false, helperText, props = {}, children } = {}) => (
    <ProfileField
      key={name}
      name={name}
      label={label}
      form={form}
      errors={errors}
      onChange={setField(name)}
      required={required}
      helperText={helperText}
      textFieldProps={props}
    >
      {children}
    </ProfileField>
  );

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

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Paper variant="outlined" component="section" aria-labelledby="personal-heading" sx={{ p: 2, display: 'grid', gap: 2 }}>
          <Typography id="personal-heading" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            Personal details
          </Typography>
          <Box sx={{ display: 'grid', gap: '14px 12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {field('name', 'Full name', { required: true, props: { autoComplete: 'name' } })}
            {field('email', 'Email', { required: true, props: { type: 'email', autoComplete: 'email' } })}
            {field('phone', 'Phone', { props: { type: 'tel', autoComplete: 'tel' } })}
            {field('dateOfBirth', 'Date of birth', { props: { type: 'date', slotProps: { htmlInput: { max: todayString() } } } })}
            {field('sex', 'Sex', { props: { select: true }, children: (
              <>
                <MenuItem value="">Prefer not to say</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </>
            ) })}
          </Box>
        </Paper>

        <Paper variant="outlined" component="section" aria-labelledby="health-heading" sx={{ p: 2, display: 'grid', gap: 2 }}>
          <Typography id="health-heading" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            Health details
          </Typography>
          <Box sx={{ display: 'grid', gap: '14px 12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {field('diabetesType', 'Diabetes type', { props: { select: true }, children: (
              <>
                <MenuItem value="">Not set</MenuItem>
                <MenuItem value="Type 1">Type 1</MenuItem>
                <MenuItem value="Type 2">Type 2</MenuItem>
                <MenuItem value="Gestational">Gestational</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </>
            ) })}
            {field('diagnosedYear', 'Year diagnosed', { props: textInput })}
            {field('heightCm', 'Height (cm)', { props: textInput })}
            {field('weightKg', 'Weight (kg)', { props: textInput })}
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              {field('medication', 'Medication')}
            </Box>
          </Box>
        </Paper>

        <Paper variant="outlined" component="section" aria-labelledby="targets-heading" sx={{ p: 2, display: 'grid', gap: 2 }}>
          <Typography id="targets-heading" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            Blood sugar targets
          </Typography>
          <Box sx={{ display: 'grid', gap: '14px 12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {field('targetLow', 'Target low (mg/dl)', { helperText: 'Default 70', props: textInput })}
            {field('targetHigh', 'Target high (mg/dl)', { helperText: 'Default 180', props: textInput })}
          </Box>
        </Paper>

        <Paper variant="outlined" component="section" aria-labelledby="care-heading" sx={{ p: 2, display: 'grid', gap: 2 }}>
          <Typography id="care-heading" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
            Care contacts
          </Typography>
          <Box sx={{ display: 'grid', gap: '14px 12px', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {field('doctorName', 'Doctor')}
            {field('doctorPhone', 'Doctor phone', { props: { type: 'tel' } })}
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              {field('emergencyContact', 'Emergency contact')}
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
