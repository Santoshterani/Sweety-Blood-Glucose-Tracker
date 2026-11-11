import { useCallback, useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api, ApiError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatDate, todayString } from '../dates.js';
import ReadingFormDialog from '../components/ReadingFormDialog.jsx';
import ReportCard from '../components/ReportCard.jsx';

const REPORTS = [
  { key: 'daily', title: 'Daily', empty: 'No readings for this day yet. Use “Add reading” to log one.' },
  { key: 'month-to-date', title: 'Month-to-date', empty: 'No readings so far this month.' },
  { key: 'monthly', title: 'Monthly (previous month)', empty: 'No readings were recorded in the previous month.' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [date, setDate] = useState(todayString);
  const [slots, setSlots] = useState([]);
  const [reports, setReports] = useState({}); // { daily: {...}, ... }
  const [reportErrors, setReportErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // reading being edited, or null when adding
  const [deleting, setDeleting] = useState(null); // reading waiting for delete confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState('');

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    api.slots().then(({ slots }) => setSlots(slots)).catch(() => setToast('Could not load the time slots.'));
  }, []);

  // Load all three reports whenever the date changes or a reading is added / edited / deleted.
  useEffect(() => {
    if (!date) return undefined;
    let cancelled = false; // ignore answers that arrive after the user picked another date
    setLoading(true);

    Promise.allSettled(REPORTS.map((r) => api.report(r.key, date))).then((results) => {
      if (cancelled) return;
      const nextReports = {};
      const nextErrors = {};
      results.forEach((result, i) => {
        const key = REPORTS[i].key;
        if (result.status === 'fulfilled') nextReports[key] = result.value;
        else nextErrors[key] = result.reason instanceof ApiError ? result.reason.message : 'Could not load this report.';
      });
      setReports(nextReports);
      setReportErrors(nextErrors);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (reading) => {
    setEditing(reading);
    setFormOpen(true);
  };

  function handleSaved(savedDate) {
    setFormOpen(false);
    setToast(editing ? 'Reading updated.' : 'Reading added.');
    setDate(savedDate); // jump to the day that was just changed so the person sees it
    reload();
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await api.deleteReading(deleting.id);
      setToast('Reading deleted.');
      reload();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Could not delete the reading.');
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Sweety
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
            {user.name}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
          <TextField
            label="Report date"
            type="date"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayString() } }}
            sx={{ bgcolor: 'background.paper' }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} disabled={slots.length === 0}>
            Add reading
          </Button>
        </Box>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, alignItems: 'start' }}>
          {REPORTS.map((r) => (
            <ReportCard
              key={r.key}
              title={r.title}
              report={reports[r.key]}
              error={reportErrors[r.key]}
              loading={loading}
              emptyText={r.empty}
              onEdit={r.key === 'daily' ? openEdit : undefined}
              onDelete={r.key === 'daily' ? setDeleting : undefined}
            />
          ))}
        </Box>
      </Container>

      <ReadingFormDialog
        open={formOpen}
        reading={editing}
        defaultDate={date || todayString()}
        slots={slots}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <Dialog open={Boolean(deleting)} onClose={deleteBusy ? undefined : () => setDeleting(null)}>
        <DialogTitle>Delete this reading?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleting && `${deleting.slotLabel} · ${deleting.value} mg/dl on ${formatDate(deleting.date)}. This cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleteBusy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
