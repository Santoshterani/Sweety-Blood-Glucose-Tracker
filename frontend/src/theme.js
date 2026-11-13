import { createTheme } from '@mui/material/styles';

const heading = { fontFamily: "'Manrope', 'Inter', sans-serif", letterSpacing: '-0.01em' };

export const theme = createTheme({
  palette: {
    primary: { main: '#0B6E64', dark: '#0B5A52', light: '#E3F3F0', contrastText: '#FFFFFF' },
    secondary: { main: '#3F4F4B' },
    error: { main: '#B3261E' },
    background: { default: '#F4F6F5', paper: '#FFFFFF' },
    text: { primary: '#14211F', secondary: '#55645F' },
    divider: '#E1E7E4',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { ...heading, fontWeight: 800 },
    h2: { ...heading, fontWeight: 800 },
    h3: { ...heading, fontWeight: 800 },
    h4: { ...heading, fontWeight: 800, fontSize: '2rem' },
    h5: { ...heading, fontWeight: 700 },
    h6: { ...heading, fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          position: 'static',
          transform: 'none',
          transformOrigin: 'unset',
          maxWidth: 'none',
          marginBottom: 4,
          color: '#435779',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.06em',
          lineHeight: 1.2,
          textTransform: 'uppercase',
          '&.MuiInputLabel-shrink': { transform: 'none' },
          '&.Mui-focused': { color: '#435779' },
          '&.Mui-error': { color: '#B3261E' },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44, borderRadius: 12, paddingInline: 20 } },
    },
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#E1E7E4', borderRadius: 16 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: '#FFFFFF',
          fontSize: 12,
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9BAAC3' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0B6E64' },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#B3261E' },
        },
        notchedOutline: {
          borderColor: '#D9E1EF',
          '& legend': { width: '0 !important' },
        },
      },
    },
    MuiTab: { styleOverrides: { root: { minHeight: 44, minWidth: 96, fontWeight: 600, textTransform: 'none' } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, fontSize: 13, color: '#3F4F4B', background: '#F7FAF9' } } },
  },
});

/**
 * Roomier fields for the main forms (log in, sign up, add reading): a readable 14px label above a 16px input.
 * Put it in the `sx` of the container that holds the fields. The app-wide default stays the compact style.
 */
export const roomyFields = {
  '& .MuiInputLabel-root': {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.4,
    marginBottom: '8px',
    textTransform: 'none',
    color: '#14211F',
    '&.Mui-focused': { color: '#14211F' },
    '&.Mui-error': { color: '#B3261E' },
  },
  '& .MuiOutlinedInput-root': { fontSize: 16, borderRadius: '12px' },
  '& .MuiOutlinedInput-input': { padding: '15px 16px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#7C8F89' },
  '& .MuiFormHelperText-root': { fontSize: 13, marginLeft: 0, marginTop: '6px' },
  '& .MuiButton-root': { minHeight: 56, borderRadius: '12px', fontSize: 16 },
};
