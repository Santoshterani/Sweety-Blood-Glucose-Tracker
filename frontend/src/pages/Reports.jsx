import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Paper,
  Skeleton,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { api, ApiError, downloadPatientReportPdf, downloadReportPdf } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { addDays, formatDate, formatLongDate, formatMonth, formatRange, todayString } from '../dates.js';
import { targetOf } from '../status.js';
import PageHeader from '../components/PageHeader.jsx';
import AppToast from '../components/AppToast.jsx';
import StatTile from '../components/StatTile.jsx';
import StatusChip from '../components/StatusChip.jsx';
import { BarChart, ChartLegend } from '../components/Charts.jsx';

const TABS = [
  { value: 'daily', label: 'Daily', hint: 'The selected date' },
  { value: 'weekly', label: 'Weekly', hint: 'Choose a start and end date' },
  { value: 'monthly', label: 'Monthly', hint: 'Choose a month and year' },
  { value: 'yearly', label: 'Yearly', hint: 'Choose a year' },
  { value: 'custom', label: 'Custom', hint: 'Choose your own start and end dates' },
];

const CHART_TITLES = { slot: 'Each reading', day: 'Average per day', week: 'Average per week', month: 'Average per month' };
const TABLE_TITLES = { slot: 'Readings', day: 'Day by day', week: 'Week by week', month: 'Month by month' };
const FIRST_COLUMN = { slot: 'Time slot', day: 'Day', week: 'Week', month: 'Month' };
const DETAIL_PAGE_SIZE = 10;

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

function monthRange(month, today) {
  if (!month) return { from: '', to: '' };
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: month === today.slice(0, 7) ? today : `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function yearRange(year, today) {
  if (!year) return { from: '', to: '' };
  const selectedYear = String(Number(year));
  return { from: `${selectedYear}-01-01`, to: selectedYear === today.slice(0, 4) ? today : `${selectedYear}-12-31` };
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

/**
 * A patient's own reports. A doctor passes `patient` ({ id, name, targetLow, targetHigh }) to see that patient's
 * reports instead; `eyebrow` (a back link) and `intro` (patient details) are shown around the page header.
 */
export default function Reports({ patient = null, eyebrow = null, intro = null }) {
  const { user } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const target = patient ? { low: patient.targetLow, high: patient.targetHigh } : targetOf(user);
  const today = todayString();
  const currentMonth = today.slice(0, 7);
  const currentYear = Number(today.slice(0, 4));

  const [tab, setTab] = useState('weekly');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(String(currentYear));

  const [report, setReport] = useState(null);
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [detailPage, setDetailPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const isCustom = tab === 'custom';
  const isWeekly = tab === 'weekly';
  const isMonthly = tab === 'monthly';
  const isYearly = tab === 'yearly';
  const isDateRange = isCustom || isWeekly;
  const errors = useMemo(() => {
    if (isDateRange) return customErrors(from, to);
    if (isMonthly) {
      if (!month) return { month: 'Please select a month.' };
      if (month > currentMonth) return { month: 'Month cannot be in the future.' };
      return {};
    }
    if (isYearly) {
      const selectedYear = Number(year);
      if (!year) return { year: 'Please select a year.' };
      if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > currentYear) {
        return { year: `Choose a year between 1900 and ${currentYear}.` };
      }
      return {};
    }
    if (!date) return { date: 'Please select a date.' };
    if (date > today) return { date: 'Date cannot be in the future.' };
    return {};
  }, [isDateRange, isMonthly, isYearly, from, to, month, currentMonth, year, currentYear, date, today]);
  const valid = Object.keys(errors).length === 0;
  const params = isDateRange
    ? { from, to }
    : isMonthly
      ? monthRange(month, today)
      : isYearly
        ? yearRange(year, today)
        : { date };

  useEffect(() => {
    if (!valid) {
      setReport(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false; // ignore answers that arrive after the user changed the dates again
    setLoading(true);
    const load = patient ? api.patientReport(patient.id, tab, params) : api.report(tab, params);
    load
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
  }, [tab, date, from, to, month, year, valid, isDateRange, isMonthly, isYearly, patient]);

  async function handleExport() {
    setExporting(true);
    try {
      await (patient ? downloadPatientReportPdf(patient.id, tab, params) : downloadReportPdf(tab, params));
      setToast({ message: 'PDF downloaded.', severity: 'success' });
    } catch (err) {
      setToast({ message: err instanceof ApiError ? err.message : 'Could not create the PDF.', severity: 'error' });
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
  const selectedReadings = selectedBucket?.readings || [];
  const detailPageCount = Math.max(1, Math.ceil(selectedReadings.length / DETAIL_PAGE_SIZE));
  const pagedReadings = selectedReadings.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  function openBucket(bucket) {
    setSelectedBucket(bucket);
    setDetailPage(1);
  }

  return (
    <>
      {eyebrow}
      <PageHeader
        title={patient ? patient.name : 'Reports'}
        subtitle={patient ? 'Highest, lowest and average readings for any period.' : 'Highest, lowest and average readings for any period.'}
        action={
          <Button variant="contained" size="large" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={!valid || exporting}>
            {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </Button>
        }
      />

      {intro}

      <Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Report period" variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} id={`tab-${t.value}`} aria-controls="report-panel" />
          ))}
        </Tabs>
      </Box>

      <Paper variant="outlined" component="section" id="report-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 3 }}>
        {/* ---------- date controls ---------- */}
        {isDateRange ? (
          <Box sx={{ p: 2.5, borderRadius: '14px', bgcolor: '#F7FAF9', display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="From"
                required
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
                required
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                error={Boolean(errors.to)}
                helperText={errors.to || ' '}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from, max: today } }}
                sx={{ flex: '1 1 200px', maxWidth: 260, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
              />
            </Box>
            {isCustom && (
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
            )}
          </Box>
        ) : isMonthly ? (
          <TextField
            label="Month"
            required
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            error={Boolean(errors.month)}
            helperText={errors.month || TABS.find((t) => t.value === tab).hint}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: currentMonth } }}
            sx={{ width: { xs: '100%', sm: 320 }, maxWidth: '100%' }}
          />
        ) : isYearly ? (
          <TextField
            label="Year"
            required
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            error={Boolean(errors.year)}
            helperText={errors.year || TABS.find((t) => t.value === tab).hint}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1900, max: currentYear, step: 1, inputMode: 'numeric' } }}
            sx={{ width: { xs: '100%', sm: 320 }, maxWidth: '100%' }}
          />
        ) : (
          <TextField
            label="Report date"
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={Boolean(errors.date)}
            helperText={errors.date || TABS.find((t) => t.value === tab).hint}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            sx={{ width: { xs: '100%', sm: 320 }, maxWidth: '100%' }}
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
                  {patient ? `Pick a different ${isDateRange ? 'range' : 'period'}. ${patient.name} has not logged readings in this period.` : `Pick a different ${isDateRange ? 'range' : 'period'}, or log a reading to start building this report.`}
                </Typography>
                {!patient && (
                  <Button component={RouterLink} to="/readings" variant="outlined">
                    Add a reading
                  </Button>
                )}
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
                            <TableRow key={b.name} hover onClick={() => openBucket(b)} sx={{ cursor: 'pointer' }}>
                              <TableCell component="th" scope="row">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    aria-label={`View readings for ${b.name}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openBucket(b);
                                    }}
                                  >
                                    <KeyboardArrowRightIcon fontSize="small" />
                                  </IconButton>
                                  {b.name}
                                </Box>
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

      <Dialog open={Boolean(selectedBucket)} onClose={() => setSelectedBucket(null)} fullWidth maxWidth="md" fullScreen={mobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>Readings for {selectedBucket?.name}</Box>
          <IconButton aria-label="Close readings" onClick={() => setSelectedBucket(null)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table size="small" sx={{ minWidth: 560 }} aria-label={`Readings for ${selectedBucket?.name || 'selected period'}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Time slot</TableCell>
                      <TableCell>Glucose (mg/dl)</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedReadings.map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell>{formatDate(reading.date)}</TableCell>
                        <TableCell>{reading.slotLabel}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{reading.value}</TableCell>
                        <TableCell>
                          <StatusChip value={reading.value} target={target} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {selectedReadings.length ? (detailPage - 1) * DETAIL_PAGE_SIZE + 1 : 0}–
                  {Math.min(detailPage * DETAIL_PAGE_SIZE, selectedReadings.length)} of {selectedReadings.length} readings
                </Typography>
                {detailPageCount > 1 && (
                  <Pagination
                    count={detailPageCount}
                    page={detailPage}
                    onChange={(_, page) => setDetailPage(page)}
                    shape="rounded"
                    color="primary"
                    showFirstButton
                    showLastButton={!mobile}
                    siblingCount={0}
                    size={mobile ? 'small' : 'medium'}
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
