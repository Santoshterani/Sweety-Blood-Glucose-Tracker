import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Divider, FormControl, FormHelperText, FormLabel, Link, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import PasswordField from '../components/PasswordField.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ name, email, password }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Please enter your name.';
  if (!email.trim()) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Please enter a valid email address.';
  if (!password) errors.password = 'Please enter a password.';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  return errors;
}

export default function Signup() {
  const { startSession } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      startSession(await api.signup(form));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors(err.fieldErrors || {});
      if (Object.keys(err.fieldErrors || {}).length === 0) setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Your readings are private to you.">
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2.5 }}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <FormControl error={Boolean(errors.role)}>
          <FormLabel id="role-label" sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 1, '&.Mui-focused': { color: 'text.primary' } }}>
            I am a
          </FormLabel>
          <ToggleButtonGroup
            exclusive
            fullWidth
            color="primary"
            value={form.role}
            onChange={(_, role) => role && setForm((f) => ({ ...f, role }))}
            aria-labelledby="role-label"
            sx={{ '& .MuiToggleButton-root': { minHeight: 48, textTransform: 'none', fontWeight: 600, fontSize: 15, borderRadius: '12px' } }}
          >
            <ToggleButton value="patient">Patient</ToggleButton>
            <ToggleButton value="doctor">Doctor</ToggleButton>
          </ToggleButtonGroup>
          <FormHelperText>
            {errors.role || (form.role === 'doctor' ? 'Patients choose you from their profile to share their reports with you.' : 'Track your own blood glucose readings.')}
          </FormHelperText>
        </FormControl>
        <TextField
          label="Name"
          required
          autoComplete="name"
          value={form.name}
          onChange={setField('name')}
          error={Boolean(errors.name)}
          helperText={errors.name}
          autoFocus
          fullWidth
        />
        <TextField
          label="Email"
          required
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={setField('email')}
          error={Boolean(errors.email)}
          helperText={errors.email}
          fullWidth
        />
        <PasswordField
          label="Password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={setField('password')}
          error={Boolean(errors.password)}
          helperText={errors.password || 'At least 8 characters.'}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </Button>
        <Divider sx={{ mt: 0.5 }} />
        <Typography align="center" color="text.secondary">
          Already have an account?{' '}
          <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
            Log in
          </Link>
        </Typography>
      </Box>
    </AuthShell>
  );
}
