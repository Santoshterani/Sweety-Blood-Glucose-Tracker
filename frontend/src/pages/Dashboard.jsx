import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, LinearProgress, Link, List, ListItem, ListItemText, Paper, Skeleton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatDate, formatLongDate, formatShortDate } from '../dates.js';
import { toneFor } from '../status.js';
import PageHeader from '../components/PageHeader.jsx';
import StatTile from '../components/StatTile.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { ChartLegend, LineChart } from '../components/Charts.jsx';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

const shortDay = (iso) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

function Panel({ title, action, children, sx }) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2, alignContent: 'start', ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reminders, setReminders] = useState([]);

  // The daily reminder log (written by the background job). It is a nice-to-have: failures are ignored.
  useEffect(() => {
    let cancelled = false;
    api
      .reminders()
      .then((res) => !cancelled && setReminders(res.reminders))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .dashboard()
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const addButton = (
    <Button component={RouterLink} to="/readings" variant="contained" size="large" startIcon={<AddIcon />}>
      Add reading
    </Button>
  );
  const firstName = (user?.name || '').split(' ')[0];

  if (error) {
    return (
      <>
        <PageHeader title={`${greeting()}, ${firstName}`} action={addButton} />
        <Alert severity="error">{error}</Alert>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title={`${greeting()}, ${firstName}`} action={addButton} />
        <Skeleton variant="rounded" height={200} />
        <Skeleton variant="rounded" height={110} />
        <Skeleton variant="rounded" height={320} />
      </>
    );
  }

  const { target, today, week, trend, recent } = data;
  const noReadingsYet = recent.length === 0;
  const trendPoints = trend.map((t) => ({ label: shortDay(t.date), value: t.average }));
  const note = (r) => (r ? `${formatShortDate(r.date)} · ${r.slotLabel}` : 'No readings yet');

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} subtitle={formatLongDate(data.date)} action={addButton} />

      <Panel
        title="Today’s readings"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            <Typography variant="body2">{today.logged} of 4 logged</Typography>
            <LinearProgress variant="determinate" value={(today.logged / 4) * 100} aria-label="Readings logged today" sx={{ width: 120, height: 8, borderRadius: 4 }} />
          </Box>
        }
      >
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
          {today.slots.map((s) => (
            <Box
              key={s.slot}
              sx={{
                p: 2.25,
                minHeight: 136,
                borderRadius: '14px',
                display: 'grid',
                gap: 1,
                alignContent: 'start',
                border: s.reading ? '1px solid #E1E7E4' : '1.5px dashed #84928C',
                bgcolor: s.reading ? 'background.paper' : '#FAFBFA',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {s.label}
              </Typography>
              {s.reading ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                    <Typography variant="h4" component="div" sx={{ fontSize: 36 }}>
                      {s.reading.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      mg/dl
                    </Typography>
                  </Box>
                  <Box>
                    <StatusChip value={s.reading.value} target={target} />
                  </Box>
                </>
              ) : (
                <>
                  <Typography color="text.secondary">Not logged yet</Typography>
                  <Box>
                    <Button component={RouterLink} to="/readings" variant="outlined" size="small">
                      Add reading
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          ))}
        </Box>
      </Panel>

      <Box component="section" aria-label="Last 7 days" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <StatTile bordered label="Average" value={week.average === null ? '–' : week.average.toFixed(1)} unit="mg/dl" note={`Last 7 days · ${week.count} ${week.count === 1 ? 'reading' : 'readings'}`} />
        <StatTile bordered label="Highest" value={week.highest ?? '–'} unit="mg/dl" note={note(week.highestReading)} />
        <StatTile bordered label="Lowest" value={week.lowest ?? '–'} unit="mg/dl" note={note(week.lowestReading)} />
        <StatTile bordered label="In target range" value={week.inRangePercent ?? '–'} unit={week.inRangePercent === null ? '' : '%'} note={`Target ${target.low}–${target.high} mg/dl`} />
      </Box>

      {noReadingsYet ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', display: 'grid', gap: 1.5, justifyItems: 'center' }}>
          <Typography variant="h6">Welcome to Sweety</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            Add your first blood glucose reading and your trends and reports will appear here.
          </Typography>
          {addButton}
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
          <Panel title="Daily average, last 14 days" sx={{ minWidth: 0 }}>
            <LineChart
              points={trendPoints}
              target={target}
              ariaLabel={`Line chart of the daily average glucose for the last 14 days. Target range is ${target.low} to ${target.high} mg/dl.`}
            />
            <ChartLegend target={target} />
          </Panel>

          <Panel
            title="Recent readings"
            action={
              <Link component={RouterLink} to="/readings" underline="hover" sx={{ fontWeight: 600, fontSize: 14 }}>
                View all
              </Link>
            }
            sx={{ minWidth: 0 }}
          >
            <List disablePadding>
              {recent.map((r) => (
                <ListItem key={r.id} disableGutters divider sx={{ gap: 1.5 }} secondaryAction={null}>
                  <ListItemText primary={r.slotLabel} secondary={formatShortDate(r.date)} slotProps={{ primary: { fontWeight: 500 } }} />
                  <Typography variant="h6" component="span" sx={{ fontSize: 18 }} style={{ color: toneFor(r.value, target).fg }}>
                    {r.value}
                  </Typography>
                  <StatusChip value={r.value} target={target} />
                </ListItem>
              ))}
            </List>
          </Panel>
        </Box>
      )}

      {reminders.length > 0 && (
        <Panel title="Daily reminders" sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            Each evening Sweety notes the days you had fewer than 4 readings.
          </Typography>
          <List disablePadding>
            {reminders.slice(0, 5).map((r) => (
              <ListItem key={r.id} disableGutters divider>
                <ListItemText primary={formatDate(r.date)} secondary={r.message} slotProps={{ primary: { fontWeight: 500 } }} />
              </ListItem>
            ))}
          </List>
        </Panel>
      )}
    </>
  );
}
