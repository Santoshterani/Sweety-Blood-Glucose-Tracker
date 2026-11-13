import { Alert, Snackbar } from '@mui/material';

export default function AppToast({ toast, onClose }) {
  const message = toast?.message || '';
  const severity = toast?.severity || 'info';

  return (
    <Snackbar
      open={Boolean(message)}
      autoHideDuration={3500}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClose={onClose}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="standard"
        sx={{
          width: { xs: 'calc(100vw - 32px)', sm: 420 },
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(20, 33, 31, 0.16)',
          ...(severity === 'success'
            ? {
                bgcolor: 'primary.light',
                color: 'primary.dark',
                '& .MuiAlert-icon': { color: 'primary.dark' },
              }
            : severity === 'error'
              ? {
                  bgcolor: '#FDEDEA',
                  color: '#7A271A',
                  '& .MuiAlert-icon': { color: 'error.main' },
                }
              : {}),
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
