import { Box, Typography } from '@mui/material';

export default function PageHeader({ title, subtitle, action }) {
  return (
    <Box component="header" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: { xs: 'stretch', sm: 'flex-end' }, justifyContent: 'space-between', gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 26, sm: 32 }, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && (
        <Box sx={{ width: { xs: '100%', sm: 'auto' }, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}>
          {action}
        </Box>
      )}
    </Box>
  );
}
