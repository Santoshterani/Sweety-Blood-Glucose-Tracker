import { Alert, Box, Card, CardContent, Divider, IconButton, List, ListItem, ListItemText, Skeleton, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatRange } from '../dates.js';

function Stat({ label, value, unit }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" component="div">
        {value}
        {unit && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {unit}
          </Typography>
        )}
      </Typography>
    </Box>
  );
}

/**
 * One report: title + date range, then highest / lowest / average / count.
 * `onEdit` / `onDelete` are only passed for the daily report, which also lists every reading.
 */
export default function ReportCard({ title, report, loading, error, emptyText, onEdit, onDelete }) {
  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 20 }}>
          {report ? formatRange(report.from, report.to) : ' '}
        </Typography>

        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : loading && !report ? (
          <Skeleton variant="rounded" height={90} />
        ) : report && report.count === 0 ? (
          <Alert severity="info" icon={false}>
            {emptyText}
          </Alert>
        ) : report ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, opacity: loading ? 0.5 : 1 }}>
              <Stat label="Highest" value={report.highest} unit="mg/dl" />
              <Stat label="Lowest" value={report.lowest} unit="mg/dl" />
              <Stat label="Average" value={report.average.toFixed(1)} unit="mg/dl" />
              <Stat label="Readings" value={report.count} />
            </Box>

            {report.readings && (
              <>
                <Divider sx={{ my: 2 }} />
                <List dense disablePadding>
                  {report.readings.map((r) => (
                    <ListItem
                      key={r.id}
                      disableGutters
                      secondaryAction={
                        <>
                          <Tooltip title="Edit">
                            <IconButton aria-label={`Edit ${r.slotLabel} reading`} size="small" onClick={() => onEdit(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton aria-label={`Delete ${r.slotLabel} reading`} size="small" onClick={() => onDelete(r)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      }
                    >
                      <ListItemText primary={r.slotLabel} secondary={`${r.value} mg/dl`} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
