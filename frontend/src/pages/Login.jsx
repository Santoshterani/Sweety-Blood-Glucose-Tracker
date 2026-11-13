import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, TextField, Typography } from '@mui/material';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const { startSession } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!form.email.trim()) found.email = 'Please enter your email.';
    if (!form.password) found.password = 'Please enter your password.';
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      startSession(await api.login(form));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors(err.fieldErrors || {});
      if (Object.keys(err.fieldErrors || {}).length === 0) setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to track your blood glucose." showHero>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField
          label="Email"
          required
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={setField('email')}
          error={Boolean(errors.email)}
          helperText={errors.email}
          autoFocus
          fullWidth
        />
        <TextField
          label="Password"
          required
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={setField('password')}
          error={Boolean(errors.password)}
          helperText={errors.password}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
        <Typography variant="body2" align="center">
          New here?{' '}
          <Link component={RouterLink} to="/signup">
            Create an account
          </Link>
        </Typography>
      </Box>
    </AuthShell>
  );
}
