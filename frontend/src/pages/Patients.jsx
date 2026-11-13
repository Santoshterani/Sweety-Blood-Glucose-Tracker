import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Paper, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlined';
import { api } from '../api.js';
import { formatDate } from '../dates.js';
import PageHeader from '../components/PageHeader.jsx';
import StatusChip from '../components/StatusChip.jsx';

const subtitleOf = (p) => [p.diabetesType, p.age !== null ? `${p.age} yrs` : null].filter(Boolean).join(' · ');
const wide = { display: { xs: 'none', md: 'table-cell' } };

/** A doctor's home: the patients who chose them, with their last 7 days at a glance. */
export default function Patients() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .doctorPatients()
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Patients" subtitle="Patients who chose you as their doctor. Open one to see their reports." />

      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Skeleton variant="rounded" height={260} />}

      {data && data.patients.length === 0 && (
        <Paper variant="outlined" sx={{ p: 6, display: 'grid', justifyItems: 'center', gap: 1.25, textAlign: 'center' }}>
          <PeopleOutlineIcon aria-hidden="true" sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="h6">No patients yet</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 440 }}>
            Patients appear here after they choose you under <strong>Profile → My doctor on Sweety</strong>. Ask them to pick your name there.
          </Typography>
        </Paper>
      )}

      {data && data.patients.length > 0 && (
        <Paper variant="outlined" component="section" aria-labelledby="patients-heading" sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2.5, sm: 3 }, pb: 2 }}>
            <Typography id="patients-heading" variant="h5" component="h2">
              {data.patients.length} {data.patients.length === 1 ? 'patient' : 'patients'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Summary of the last 7 days ({formatDate(data.period.from)} – {formatDate(data.period.to)})
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: { xs: 2.5, sm: 3 } }}>Patient</TableCell>
                  <TableCell>Last reading</TableCell>
                  <TableCell sx={wide}>7-day average</TableCell>
                  <TableCell sx={wide}>In range</TableCell>
                  <TableCell sx={wide}>Readings</TableCell>
                  <TableCell align="right" sx={{ pr: { xs: 2, sm: 3 } }}>
                    <Box component="span" sx={{ position: 'absolute', left: -9999 }}>Actions</Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.patients.map((p) => {
                  const target = { low: p.targetLow, high: p.targetHigh };
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell component="th" scope="row" sx={{ pl: { xs: 2.5, sm: 3 } }}>
                        <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {subtitleOf(p) || '–'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5, overflowWrap: 'anywhere' }}>
                          7-day average {p.week.average !== null ? `${p.week.average.toFixed(1)} mg/dl` : '–'} · In range{' '}
                          {p.week.inRangePercent !== null ? `${p.week.inRangePercent}%` : '–'} · {p.week.count} readings
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {p.lastReading ? (
                          <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'start' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography component="span" sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 17 }}>
                                {p.lastReading.value}
                              </Typography>
                              <StatusChip value={p.lastReading.value} target={target} />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {p.lastReading.slotLabel}, {formatDate(p.lastReading.date)}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography color="text.secondary">No readings yet</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={wide}>{p.week.average !== null ? `${p.week.average.toFixed(1)} mg/dl` : '–'}</TableCell>
                      <TableCell sx={wide}>{p.week.inRangePercent !== null ? `${p.week.inRangePercent}%` : '–'}</TableCell>
                      <TableCell sx={wide}>{p.week.count}</TableCell>
                      <TableCell align="right" sx={{ pr: { xs: 2, sm: 3 }, whiteSpace: 'nowrap' }}>
                        <Button component={RouterLink} to={`/patients/${p.id}`} variant="outlined" size="small" aria-label={`View reports for ${p.name}`}>
                          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>View reports</Box>
                          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>View</Box>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </>
  );
}
