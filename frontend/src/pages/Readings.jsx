import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatDate, todayString } from '../dates.js';
import { targetOf } from '../status.js';
import PageHeader from '../components/PageHeader.jsx';
import ReadingForm from '../components/ReadingForm.jsx';
import StatusChip from '../components/StatusChip.jsx';

const PER_PAGE = 10;

export default function Readings() {
  const { user } = useAuth();
  const target = targetOf(user);

  const [slots, setSlots] = useState([]);
  const [slotFilter, setSlotFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.slots().then(({ slots }) => setSlots(slots)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listReadings({ page, limit: PER_PAGE, slot: slotFilter === 'all' ? undefined : slotFilter })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setPagination(res.pagination);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, slotFilter, refreshKey]);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  function handleAdded() {
    setPage(1); // new readings show at the top of the newest-first list
    setSlotFilter('all');
    reload();
  }

  function handleEdited() {
    setEditing(null);
    setToast('Reading updated.');
    reload();
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await api.deleteReading(deleting.id);
      setToast('Reading deleted.');
      if (rows.length === 1 && page > 1) setPage(page - 1); // don't strand the user on an empty page
      else reload();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Could not delete the reading.');
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  const start = (pagination.page - 1) * PER_PAGE;
  const rangeText = pagination.total ? `Showing ${start + 1}–${start + rows.length} of ${pagination.total}` : 'No readings found';

  return (
    <>
      <PageHeader title="Readings" subtitle="Add a reading and see every reading you have logged, newest first." />

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(320px, 1fr)' }, alignItems: 'start' }}>
        {/* ---------- table ---------- */}
        <Paper variant="outlined" component="section" aria-label="Readings list" sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              select
              size="small"
              label="Time slot"
              value={slotFilter}
              onChange={(e) => {
                setSlotFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">All slots</MenuItem>
              {slots.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary" aria-live="polite">
              {loading && rows.length === 0 ? '' : rangeText}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          <TableContainer>
            <Table sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Time slot</TableCell>
                  <TableCell>Value (mg/dl)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ opacity: loading && rows.length ? 0.5 : 1 }}>
                {loading && rows.length === 0 &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton height={28} />
                      </TableCell>
                    </TableRow>
                  ))}
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.slotLabel}</TableCell>
                    <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 17 }}>{r.value}</TableCell>
                    <TableCell>
                      <StatusChip value={r.value} target={target} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton aria-label={`Edit ${r.slotLabel} reading on ${formatDate(r.date)}`} onClick={() => setEditing(r)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton aria-label={`Delete ${r.slotLabel} reading on ${formatDate(r.date)}`} color="error" onClick={() => setDeleting(r)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && !error && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                      {slotFilter === 'all' ? 'No readings yet. Use the form to add your first one.' : 'No readings for this time slot.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </Typography>
            <Pagination count={Math.max(1, pagination.totalPages)} page={pagination.page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" showFirstButton showLastButton />
          </Box>
        </Paper>

        {/* ---------- add reading ---------- */}
        <Paper variant="outlined" component="section" aria-labelledby="add-heading" sx={{ p: 3, display: 'grid', gap: 2.5 }}>
          <Box>
            <Typography id="add-heading" variant="h5" component="h2">
              Add reading
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Up to 4 a day, one per time slot.
            </Typography>
          </Box>
          {slots.length === 0 ? <Skeleton variant="rounded" height={320} /> : <ReadingForm slots={slots} defaultDate={todayString()} onSaved={handleAdded} />}
        </Paper>
      </Box>

      {/* ---------- edit dialog ---------- */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit reading</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {editing && <ReadingForm slots={slots} reading={editing} onSaved={handleEdited} onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* ---------- delete confirmation ---------- */}
      <Dialog open={Boolean(deleting)} onClose={deleteBusy ? undefined : () => setDeleting(null)}>
        <DialogTitle>Delete this reading?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleting && `${deleting.slotLabel} · ${deleting.value} mg/dl on ${formatDate(deleting.date)}. This cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)} disabled={deleteBusy} color="secondary">
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleteBusy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </>
  );
}
