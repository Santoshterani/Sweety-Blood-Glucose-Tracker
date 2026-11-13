import { Box, Container, Paper, Typography } from '@mui/material';
import Logo from './Logo.jsx';

/** The centred card used by the log in and sign up pages. */
export default function AuthShell({ title, subtitle, children, showHero = false }) {
  if (showHero) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(420px, 0.9fr)' },
          bgcolor: '#F4F8F5',
        }}
      >
        <Box
          component="section"
          aria-label="Diabetes care illustration"
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100vh',
            p: { md: 5, lg: 8 },
            bgcolor: '#F4F8F5',
            overflow: 'hidden',
          }}
        >
          <Logo />
          <Box sx={{ width: '100%', maxWidth: 620, mx: 'auto', py: 3 }}>
            <Typography variant="h3" component="p" sx={{ maxWidth: 520, mb: 1.5, fontSize: { md: 36, lg: 44 } }}>
              Small steps. Stronger days.
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 440, fontSize: 16, lineHeight: 1.7 }}>
              A little daily care goes a long way. Keep your blood glucose journey in view, one reading at a time.
            </Typography>
            <Box
              component="img"
              src="/glucose-care.svg"
              alt="Illustration of a blood glucose meter displaying a reading and a simple tracking chart"
              sx={{ display: 'block', width: '100%', maxWidth: 500, mx: 'auto', mt: 2 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Your health, one day at a time.
          </Typography>
        </Box>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'grid',
            alignContent: 'center',
            justifyItems: 'center',
            px: { xs: 2, sm: 4 },
            py: 5,
            bgcolor: '#F4F8F5',
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 520 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
              <Logo />
            </Box>
            <Paper
              variant="outlined"
              sx={{ p: { xs: 3, sm: 5 }, boxShadow: '0 20px 60px rgba(20, 54, 46, 0.08)' }}
            >
              <Typography variant="h5" component="h1" gutterBottom>
                {title}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                {subtitle}
              </Typography>
              {children}
            </Paper>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center', py: 6 }}>
      <Container maxWidth="xs">
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
          <Logo />
        </Box>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h1" gutterBottom>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
          {children}
        </Paper>
      </Container>
    </Box>
  );
}
