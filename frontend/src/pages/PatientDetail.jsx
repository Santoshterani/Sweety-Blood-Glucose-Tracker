import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Paper, Skeleton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { api } from '../api.js';
import Reports from './Reports.jsx';

function Fact({ label, value }) {
  return (
    <Box sx={{ px: 2.25, py: 1.5, borderRadius: '12px', bgcolor: '#F7FAF9', minWidth: 110, maxWidth: '100%' }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }} component="div">
        {value || '–'}
      </Typography>
    </Box>
  );
}

const back = (
  <Button component={RouterLink} to="/patients" startIcon={<ArrowBackIcon />} color="secondary" sx={{ justifySelf: 'start', ml: -1.5 }}>
    All patients
  </Button>
);

/** One patient's details and reports, seen by their doctor. */
export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPatient(null);
    setError('');
    api
      .doctorPatient(id)
      .then((res) => !cancelled && setPatient(res.patient))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <>
        {back}
        <Alert severity="error">{error}</Alert>
      </>
    );
  }
  if (!patient) {
    return (
      <>
        {back}
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={320} />
      </>
    );
  }

  const intro = (
    <Paper variant="outlined" component="section" aria-label="Patient details" sx={{ p: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
      <Fact label="Age" value={patient.age !== null ? `${patient.age} yrs` : null} />
      <Fact label="Sex" value={patient.sex} />
      <Fact label="Diabetes type" value={patient.diabetesType} />
      <Fact label="Diagnosed" value={patient.diagnosedYear} />
      <Fact label="BMI" value={patient.bmi} />
      <Fact label="Target range" value={`${patient.targetLow}–${patient.targetHigh} mg/dl`} />
      <Fact label="Medication" value={patient.medication} />
      <Fact label="Contact" value={[patient.phone, patient.email].filter(Boolean).join(' · ')} />
    </Paper>
  );

  return <Reports patient={patient} eyebrow={back} intro={intro} />;
}
