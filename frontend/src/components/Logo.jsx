import { Box, Typography } from '@mui/material';

export default function Logo({ size = 'medium' }) {
  const box = size === 'small' ? 30 : 36;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ width: box, height: box, borderRadius: '10px', bgcolor: 'primary.main', display: 'grid', placeItems: 'center' }}>
        <svg width={box * 0.55} height={box * 0.55} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
          <path d="M12 2.7s6 6.2 6 10.8a6 6 0 0 1-12 0C6 8.9 12 2.7 12 2.7z" />
        </svg>
      </Box>
      <Typography variant="h5" component="span" sx={{ fontWeight: 800, fontSize: size === 'small' ? 20 : 22 }}>
        Sweety
      </Typography>
    </Box>
  );
}
