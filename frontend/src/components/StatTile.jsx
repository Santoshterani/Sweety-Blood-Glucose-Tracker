import { Box, Typography } from '@mui/material';

/** One headline number, e.g. "Highest 201 mg/dl". */
export default function StatTile({ label, value, unit, note, bordered = false }) {
  return (
    <Box
      sx={{
        flex: '1 1 180px',
        minWidth: 0,
        p: 2.25,
        borderRadius: '14px',
        bgcolor: bordered ? 'background.paper' : '#F7FAF9',
        border: bordered ? 1 : 0,
        borderColor: 'divider',
        display: 'grid',
        gap: 0.25,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography variant="h4" component="div" sx={{ fontSize: 30, letterSpacing: '-0.03em' }}>
          {value}
        </Typography>
        {unit && (
          <Typography variant="caption" color="text.secondary">
            {unit}
          </Typography>
        )}
      </Box>
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
    </Box>
  );
}
