import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Readings from './pages/Readings.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

/** Where each kind of account starts. */
const homeFor = (user) => (user?.role === 'doctor' ? '/patients' : '/');

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

/** Only the listed roles may see this page; anyone else goes to their own home. */
function RoleOnly({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to={homeFor(user)} replace />;
}

const PATIENT = ['patient'];
const DOCTOR = ['doctor'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<RoleOnly roles={PATIENT}><Dashboard /></RoleOnly>} />
        <Route path="/readings" element={<RoleOnly roles={PATIENT}><Readings /></RoleOnly>} />
        <Route path="/reports" element={<RoleOnly roles={PATIENT}><Reports /></RoleOnly>} />
        <Route path="/patients" element={<RoleOnly roles={DOCTOR}><Patients /></RoleOnly>} />
        <Route path="/patients/:id" element={<RoleOnly roles={DOCTOR}><PatientDetail /></RoleOnly>} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
