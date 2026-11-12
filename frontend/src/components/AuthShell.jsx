import { Box, Container, Paper, Typography } from '@mui/material';
import Logo from './Logo.jsx';

/** The centred card used by the log in and sign up pages. */
export default function AuthShell({ title, subtitle, children }) {
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
