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
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatDate, todayString } from '../dates.js';
import { targetOf } from '../status.js';
import PageHeader from '../components/PageHeader.jsx';
import AppToast from '../components/AppToast.jsx';
import ReadingForm from '../components/ReadingForm.jsx';
import StatusChip from '../components/StatusChip.jsx';

const PER_PAGE = 10;
const visuallyHidden = { position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' };

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
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(null); // { anchor, reading } for the phone's row menu

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
    setToast({ message: 'Reading updated.', severity: 'success' });
    reload();
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await api.deleteReading(deleting.id);
      setToast({ message: 'Reading deleted.', severity: 'success' });
      if (rows.length === 1 && page > 1) setPage(page - 1); // don't strand the user on an empty page
      else reload();
    } catch (err) {
      setToast({ message: err instanceof ApiError ? err.message : 'Could not delete the reading.', severity: 'error' });
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  const start = (pagination.page - 1) * PER_PAGE;
  const rangeText = pagination.total ? `Showing ${start + 1}–${start + rows.length} of ${pagination.total}` : 'No readings found';

  return (
    <>
      <PageHeader title="Readings" subtitle="Log a new reading, then review your recent ones below." />

      {/* ---------- add reading (top) ---------- */}
      <Paper variant="outlined" component="section" aria-labelledby="add-heading" sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        {slots.length === 0 ? <Skeleton variant="rounded" height={200} /> : <ReadingForm variant="wide" slots={slots} defaultDate={todayString()} onSaved={handleAdded} onValueError={(message) => setToast({ message, severity: 'error' })} />}
      </Paper>

      {/* ---------- recent readings (below) ---------- */}
      <Paper variant="outlined" component="section" aria-labelledby="recent-heading" sx={{ minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', p: { xs: 2.5, sm: 3.5 }, pb: { xs: 2, sm: 2.5 } }}>
          <Typography id="recent-heading" variant="h5" component="h2" sx={{ flex: '1 1 auto' }}>
            Recent readings
          </Typography>
          <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ order: { xs: 3, sm: 0 }, flex: { xs: '1 1 100%', sm: '0 0 auto' }, textAlign: { xs: 'right', sm: 'left' }, display: { xs: 'none', sm: 'block' } }}>
            {loading && rows.length === 0 ? '' : rangeText}
          </Typography>
          <TextField
            select
            label="Time slot"
            value={slotFilter}
            onChange={(e) => {
              setSlotFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: '100%', sm: 200 } }}
          >
            <MenuItem value="all">All time slots</MenuItem>
            {slots.map((sl) => (
              <MenuItem key={sl.value} value={sl.value}>
                {sl.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, flex: '1 1 100%', textAlign: 'right', mt: -1 }}>
            {loading && rows.length === 0 ? '' : rangeText}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        <TableContainer>
          <Table sx={{ minWidth: { sm: 640 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, pl: { sm: 3.5 } }}>Date</TableCell>
                <TableCell sx={{ pl: { xs: 2.5, sm: 2 } }}>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Time slot</Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Reading</Box>
                </TableCell>
                <TableCell>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Value (mg/dl)</Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>mg/dl</Box>
                </TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ pr: { xs: 1, sm: 3 } }}>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Actions</Box>
                  <Box component="span" sx={visuallyHidden}>Actions</Box>
                </TableCell>
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
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap', pl: { sm: 3.5 } }}>{formatDate(r.date)}</TableCell>
                  <TableCell sx={{ pl: { xs: 2.5, sm: 2 } }}>
                    {r.slotLabel}
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ display: { xs: 'block', sm: 'none' } }}>
                      {formatDate(r.date)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 17 }}>{r.value}</TableCell>
                  <TableCell>
                    <StatusChip value={r.value} target={target} />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: { xs: 0.5, sm: 2.5 } }}>
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
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
                    </Box>
                    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                      <IconButton aria-label={`Actions for ${r.slotLabel} reading on ${formatDate(r.date)}`} aria-haspopup="menu" onClick={(e) => setMenu({ anchor: e.currentTarget, reading: r })}>
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    {slotFilter === 'all' ? 'No readings yet. Use the form above to add your first one.' : 'No readings for this time slot.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between', p: { xs: 2, sm: 2.5 }, px: { sm: 3.5 } }}>
          <Typography variant="body2" color="text.secondary">
            Page {pagination.page} of {Math.max(1, pagination.totalPages)}
          </Typography>
          <Pagination count={Math.max(1, pagination.totalPages)} page={pagination.page} onChange={(_, p) => setPage(p)} shape="rounded" color="primary" showFirstButton showLastButton siblingCount={0} />
        </Box>
      </Paper>

      {/* phone: row actions menu */}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setEditing(menu.reading);
            setMenu(null);
          }}
        >
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Edit" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleting(menu.reading);
            setMenu(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>

      {/* ---------- edit dialog ---------- */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit reading</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {editing && <ReadingForm slots={slots} reading={editing} onSaved={handleEdited} onCancel={() => setEditing(null)} onValueError={(message) => setToast({ message, severity: 'error' })} />}
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

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
