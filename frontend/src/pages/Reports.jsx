import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import { api, ApiError, downloadReportPdf } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { addDays, formatDate, formatLongDate, formatMonth, formatRange, todayString } from '../dates.js';
import { targetOf } from '../status.js';
import PageHeader from '../components/PageHeader.jsx';
import StatTile from '../components/StatTile.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { BarChart, ChartLegend } from '../components/Charts.jsx';

const TABS = [
  { value: 'daily', label: 'Daily', hint: 'The selected date' },
  { value: 'weekly', label: 'Weekly', hint: 'The 7 days ending on the selected date' },
  { value: 'monthly', label: 'Monthly', hint: 'The whole month before the selected date' },
  { value: 'yearly', label: 'Yearly', hint: '1 January up to the selected date' },
  { value: 'custom', label: 'Custom', hint: 'Choose your own start and end dates' },
];

const CHART_TITLES = { slot: 'Each reading', day: 'Average per day', week: 'Average per week', month: 'Average per month' };
const TABLE_TITLES = { slot: 'Readings', day: 'Day by day', week: 'Week by week', month: 'Month by month' };
const FIRST_COLUMN = { slot: 'Time slot', day: 'Day', week: 'Week', month: 'Month' };

/** Same checks as the server so people see the message instantly. */
function customErrors(from, to) {
  const today = todayString();
  const errors = {};
  if (!from) errors.from = 'Please select a start date.';
  else if (from > today) errors.from = 'Date cannot be in the future.';
  if (!to) errors.to = 'Please select an end date.';
  else if (to > today) errors.to = 'Date cannot be in the future.';
  if (!errors.from && !errors.to && from > to) errors.to = 'End date must be on or after the start date.';
  return errors;
}

function titleFor(report) {
  switch (report.type) {
    case 'daily':
      return formatLongDate(report.from);
    case 'weekly':
      return `Week of ${formatRange(report.from, report.to)}`;
    case 'monthly':
      return formatMonth(report.from);
    case 'yearly':
      return `Year ${report.from.slice(0, 4)}`;
    default:
      return 'Custom range';
  }
}

export default function Reports() {
  const { user } = useAuth();
  const target = targetOf(user);
  const today = todayString();

  const [tab, setTab] = useState('weekly');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');

  const isCustom = tab === 'custom';
  const errors = useMemo(() => {
    if (isCustom) return customErrors(from, to);
    if (!date) return { date: 'Please select a date.' };
    if (date > today) return { date: 'Date cannot be in the future.' };
    return {};
  }, [isCustom, from, to, date, today]);
  const valid = Object.keys(errors).length === 0;
  const params = isCustom ? { from, to } : { date };

  useEffect(() => {
    if (!valid) {
      setReport(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false; // ignore answers that arrive after the user changed the dates again
    setLoading(true);
    api
      .report(tab, isCustom ? { from, to } : { date })
      .then((res) => {
        if (cancelled) return;
        setReport(res);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setReport(null);
        setError(err.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, date, from, to, valid, isCustom]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadReportPdf(tab, params);
      setToast('PDF downloaded.');
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Could not create the PDF.');
    } finally {
      setExporting(false);
    }
  }

  const presets = [
    { label: 'Last 7 days', from: addDays(today, -6) },
    { label: 'Last 30 days', from: addDays(today, -29) },
    { label: 'Last 90 days', from: addDays(today, -89) },
    { label: 'This year', from: `${today.slice(0, 4)}-01-01` },
  ];

  const hasData = report && report.count > 0;
  const showEmpty = report && report.count === 0;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Highest, lowest and average readings for any period."
        action={
          <Button variant="contained" size="large" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={!valid || exporting}>
            {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </Button>
        }
      />

      <Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Report period" variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} id={`tab-${t.value}`} aria-controls="report-panel" />
          ))}
        </Tabs>
      </Box>

      <Paper variant="outlined" component="section" id="report-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 3 }}>
        {/* ---------- date controls ---------- */}
        {isCustom ? (
          <Box sx={{ p: 2.5, borderRadius: '14px', bgcolor: '#F7FAF9', display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="From"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                error={Boolean(errors.from)}
                helperText={errors.from || ' '}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
                sx={{ flex: '1 1 200px', maxWidth: 260, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
              />
              <TextField
                label="To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                error={Boolean(errors.to)}
                helperText={errors.to || ' '}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
                sx={{ flex: '1 1 200px', maxWidth: 260, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                Quick ranges
              </Typography>
              {presets.map((p) => {
                const on = from === p.from && to === today;
                return (
                  <Chip
                    key={p.label}
                    label={p.label}
                    clickable
                    variant="outlined"
                    aria-pressed={on}
                    onClick={() => {
                      setFrom(p.from);
                      setTo(today);
                    }}
                    sx={{
                      minHeight: 40,
                      fontWeight: 600,
                      bgcolor: on ? 'primary.light' : 'background.paper',
                      color: on ? 'primary.dark' : 'text.primary',
                      borderColor: on ? 'primary.main' : '#84928C',
                      borderWidth: on ? 2 : 1,
                      '&:hover': { bgcolor: 'primary.light' },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        ) : (
          <TextField
            label="Report date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={Boolean(errors.date)}
            helperText={errors.date || TABS.find((t) => t.value === tab).hint}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            sx={{ maxWidth: 320 }}
          />
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {loading && !report && valid && !error && <Skeleton variant="rounded" height={320} />}

        {report && (
          <Box sx={{ display: 'grid', gap: 3, opacity: loading ? 0.5 : 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="h5" component="h2">
                {titleFor(report)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatRange(report.from, report.to)}
              </Typography>
            </Box>

            {showEmpty && (
              <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1.25, textAlign: 'center', py: 6, px: 3, borderRadius: '14px', border: '1.5px dashed #84928C' }}>
                <BarChartIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                <Typography variant="h6">No readings in this period</Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 380 }}>
                  Pick a different {isCustom ? 'range' : 'date'}, or log a reading to start building this report.
                </Typography>
                <Button component={RouterLink} to="/readings" variant="outlined">
                  Add a reading
                </Button>
              </Box>
            )}

            {hasData && (
              <>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <StatTile label="Highest" value={report.highest} unit="mg/dl" />
                  <StatTile label="Lowest" value={report.lowest} unit="mg/dl" />
                  <StatTile label="Average" value={report.average.toFixed(1)} unit="mg/dl" />
                  <StatTile label="Readings" value={report.count} />
                </Box>

                <Box sx={{ display: 'grid', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{CHART_TITLES[report.bucketBy]}</Typography>
                  <BarChart
                    points={report.buckets.map((b) => ({ label: b.label, value: b.avg }))}
                    target={target}
                    ariaLabel={`${CHART_TITLES[report.bucketBy]} for ${titleFor(report)}. Highest ${report.highest}, lowest ${report.lowest}, average ${report.average.toFixed(1)} mg/dl.`}
                  />
                  <ChartLegend target={target} />
                </Box>

                <TableContainer>
                  <Table sx={{ minWidth: 520 }} aria-label={TABLE_TITLES[report.bucketBy]}>
                    <caption style={{ captionSide: 'top', textAlign: 'left', paddingBottom: 8 }}>
                      <Typography component="span" variant="h6">
                        {TABLE_TITLES[report.bucketBy]}
                      </Typography>
                    </caption>
                    <TableHead>
                      {report.bucketBy === 'slot' ? (
                        <TableRow>
                          <TableCell>{FIRST_COLUMN.slot}</TableCell>
                          <TableCell>Value (mg/dl)</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableCell>{FIRST_COLUMN[report.bucketBy]}</TableCell>
                          <TableCell>Readings</TableCell>
                          <TableCell>Lowest</TableCell>
                          <TableCell>Average</TableCell>
                          <TableCell>Highest</TableCell>
                        </TableRow>
                      )}
                    </TableHead>
                    <TableBody>
                      {report.bucketBy === 'slot'
                        ? report.buckets.map((b) => (
                            <TableRow key={b.name}>
                              <TableCell component="th" scope="row">
                                {b.name}
                              </TableCell>
                              <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 17 }}>{b.avg}</TableCell>
                              <TableCell>
                                <StatusChip value={b.avg} target={target} />
                              </TableCell>
                            </TableRow>
                          ))
                        : report.buckets.map((b) => (
                            <TableRow key={b.name}>
                              <TableCell component="th" scope="row">
                                {b.name}
                              </TableCell>
                              <TableCell>{b.count}</TableCell>
                              <TableCell>{b.low}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{b.avg.toFixed(1)}</TableCell>
                              <TableCell>{b.high}</TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        )}
      </Paper>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
