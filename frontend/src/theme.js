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
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44, borderRadius: 12, paddingInline: 20 } },
    },
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#E1E7E4', borderRadius: 16 } } },
    MuiOutlinedInput: { styleOverrides: { notchedOutline: { borderColor: '#84928C' } } },
    MuiTab: { styleOverrides: { root: { minHeight: 44, minWidth: 96, fontWeight: 600, textTransform: 'none' } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, fontSize: 13, color: '#3F4F4B', background: '#F7FAF9' } } },
  },
});
