import { Box, Paper, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Logo from './Logo.jsx';
import { roomyFields } from '../theme.js';

const RANGES = [
  { label: 'Normal', value: '70–99', color: '#0B6E64' },
  { label: 'Prediabetes', value: '100–125', color: '#C2570C' },
  { label: 'Diabetes', value: '126 or more', color: '#B3261E' },
];
const SIGNS = ['Increased thirst', 'Frequent urination', 'Unusual tiredness', 'Blurred vision', 'Slow-healing cuts'];

const cardSx = { bgcolor: '#FFFFFF', color: 'text.primary', borderRadius: '18px', p: { xs: 2.5, md: 3 }, minWidth: 0 };

function Drop({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
    </svg>
  );
}

/** "Know your ranges" and "Know the signs": general awareness information shown beside the forms. */
function AwarenessCards({ scroll = false }) {
  const cards = [
    <Paper key="ranges" elevation={0} component="section" aria-labelledby="ranges-h" sx={cardSx}>
      <Typography id="ranges-h" variant="h6" component="h2" sx={{ fontSize: 17 }}>
        Know your ranges
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
        Fasting glucose, mg/dl
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {RANGES.map((r) => (
          <Box key={r.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 14 }}>
              <Box aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color }} />
              {r.label}
            </Box>
            <Typography component="strong" sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15 }}>
              {r.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>,
    <Paper key="signs" elevation={0} component="section" aria-labelledby="signs-h" sx={cardSx}>
      <Typography id="signs-h" variant="h6" component="h2" sx={{ fontSize: 17 }}>
        Know the signs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
        Talk to a doctor if you notice
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.1, fontSize: 14 }}>
        {SIGNS.map((s) => (
          <Box component="li" key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <CheckRoundedIcon aria-hidden="true" sx={{ fontSize: 18, color: 'primary.main' }} />
            {s}
          </Box>
        ))}
      </Box>
    </Paper>,
  ];

  // On a phone the two cards sit side by side and swipe, so the page doesn't become one long stack.
  if (scroll) {
    return (
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          px: 2,
          pb: 0.5,
          '& > *': { flex: '0 0 82%', scrollSnapAlign: 'center', border: '1px solid #DCE4E1' },
        }}
      >
        {cards}
      </Box>
    );
  }
  return <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', maxWidth: 640 }}>{cards}</Box>;
}

const Pill = ({ small = false }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1,
      height: small ? 30 : 32,
      px: small ? 1.5 : 1.75,
      borderRadius: '16px',
      bgcolor: 'rgba(255,255,255,0.16)',
      fontSize: small ? 12 : 13,
      fontWeight: 600,
    }}
  >
    <Drop size={small ? 12 : 14} />
    14 November · World Diabetes Day
  </Box>
);

const DISCLAIMER = 'General information only. Your doctor sets the targets that are right for you.';

/**
 * The log in and sign up layout.
 * Desktop: an awareness panel on the left, the form card on the right.
 * Phone: a short teal header with the tagline, the form card, then swipeable awareness cards.
 */
export default function AuthShell({ title, subtitle, children }) {
  const card = (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        maxWidth: 480,
        p: { xs: 3, sm: 5 },
        borderRadius: '24px',
        borderColor: '#DCE4E1',
        boxShadow: '0 20px 50px rgba(11, 110, 100, 0.10)',
        ...roomyFields,
      }}
    >
      <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 26, sm: 32 } }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3.5 }}>
        {subtitle}
      </Typography>
      {children}
    </Paper>
  );

  const privacy = (
    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LockOutlinedIcon aria-hidden="true" sx={{ fontSize: 16 }} />
      Your readings are private to your account.
    </Typography>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.15fr) minmax(0, 1fr)' }, bgcolor: '#F4F7F6' }}>
      {/* ---------- desktop: awareness panel ---------- */}
      <Box
        component="section"
        aria-label="Diabetes awareness"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 5,
          bgcolor: 'primary.main',
          color: '#FFFFFF',
          p: { md: 6, lg: 9 },
          pt: 6,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '11px', bgcolor: '#FFFFFF', color: 'primary.main', display: 'grid', placeItems: 'center' }}>
            <Drop size={22} />
          </Box>
          <Typography variant="h5" component="span" sx={{ fontWeight: 800, fontSize: 24 }}>
            Sweety
          </Typography>
        </Box>

        <Box>
          <Pill />
          <Typography variant="h2" component="p" sx={{ mt: 2.5, fontSize: { md: 44, lg: 54 }, lineHeight: 1.06, letterSpacing: '-0.025em', maxWidth: 600 }}>
            Aware today.
            <br />
            Healthier tomorrow.
          </Typography>
          <Typography sx={{ mt: 2.5, mb: 4.5, fontSize: 19, lineHeight: 1.55, color: '#D5ECE8', maxWidth: 560 }}>
            Diabetes can develop quietly, often with no clear symptoms at first. Knowing your glucose numbers is the first step to keeping them in check.
          </Typography>
          <AwarenessCards />
        </Box>

        <Typography variant="body2" sx={{ color: '#BFE0DB', maxWidth: 560 }}>
          {DISCLAIMER}
        </Typography>
      </Box>

      {/* ---------- form side ---------- */}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* phone: tagline header */}
        <Box
          component="header"
          sx={{ display: { xs: 'block', md: 'none' }, bgcolor: 'primary.main', color: '#FFFFFF', px: 3, pt: 3.5, pb: 8, borderRadius: '0 0 28px 28px' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#FFFFFF', color: 'primary.main', display: 'grid', placeItems: 'center' }}>
              <Drop size={20} />
            </Box>
            <Typography variant="h5" component="span" sx={{ fontWeight: 800, fontSize: 22 }}>
              Sweety
            </Typography>
          </Box>
          <Box sx={{ mt: 3 }}>
            <Pill small />
          </Box>
          <Typography variant="h3" component="p" sx={{ mt: 1.75, fontSize: 30, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Aware today.
            <br />
            Healthier tomorrow.
          </Typography>
          <Typography sx={{ mt: 1.5, fontSize: 15, lineHeight: 1.5, color: '#D5ECE8' }}>
            Diabetes can develop quietly. Knowing your glucose numbers is the first step to keeping them in check.
          </Typography>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: { xs: 'flex-start', md: 'center' },
            gap: 3,
            px: { xs: 2, sm: 4 },
            pt: { xs: 0, md: 6 },
            pb: { xs: 5, md: 6 },
            mt: { xs: -5, md: 0 },
          }}
        >
          {card}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>{privacy}</Box>
        </Box>

        {/* phone: awareness cards below the form */}
        <Box sx={{ display: { xs: 'grid', md: 'none' }, gap: 2.5, pb: 5 }}>
          <AwarenessCards scroll />
          <Box sx={{ px: 3, display: 'grid', gap: 1.5, justifyItems: 'center', textAlign: 'center' }}>
            {privacy}
            <Typography variant="caption" color="text.secondary">
              {DISCLAIMER}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
