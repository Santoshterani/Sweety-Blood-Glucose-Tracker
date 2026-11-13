import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import BarChartIcon from '@mui/icons-material/BarChart';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { useAuth } from '../AuthContext.jsx';
import Logo from './Logo.jsx';

const DRAWER_WIDTH = 248;

const NAV = [
  { label: 'Dashboard', to: '/', icon: <GridViewOutlinedIcon />, end: true },
  { label: 'Readings', to: '/readings', icon: <FormatListBulletedIcon /> },
  { label: 'Reports', to: '/reports', icon: <BarChartIcon /> },
  { label: 'Profile', to: '/profile', icon: <PersonOutlineIcon /> },
];

export const initialsOf = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return letters.toUpperCase() || '?';
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState(null);

  const handleLogout = () => {
    setAccountAnchor(null);
    setMobileOpen(false);
    logout();
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2, gap: 3 }}>
      <Box sx={{ px: 1, pt: 1 }}>
        <Logo />
      </Box>

      <List component="nav" aria-label="Main" sx={{ display: 'grid', gap: 0.5, p: 0 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            sx={{
              minHeight: 44,
              borderRadius: '10px',
              color: 'secondary.main',
              '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 36 },
              '&.active': { bgcolor: 'primary.light', color: 'primary.dark', '& .MuiListItemText-primary': { fontWeight: 600 } },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ mt: 'auto', borderTop: 1, borderColor: 'divider', pt: 2, px: 1, display: 'grid', gap: 1.5 }}>
        <ButtonBase
          aria-label={`Account menu for ${user?.name || 'patient'}`}
          aria-haspopup="menu"
          aria-controls={accountAnchor ? 'account-menu' : undefined}
          aria-expanded={accountAnchor ? 'true' : undefined}
          onClick={(event) => setAccountAnchor(event.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1.5,
            minWidth: 0,
            width: '100%',
            p: 1,
            borderRadius: '10px',
            textAlign: 'left',
            '&:hover': { bgcolor: 'action.hover' },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
          }}
        >
          <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700, fontSize: 14 }}>
            {initialsOf(user?.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>
              {user?.name}
            </Typography>
            <Typography noWrap variant="body2" color="text.secondary">
              {user?.diabetesType ? `${user.diabetesType} diabetes` : 'Patient'}
            </Typography>
          </Box>
          <ExpandMoreIcon fontSize="small" color="action" />
        </ButtonBase>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ display: { md: 'none' }, borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Logo size="small" />
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Menu
        id="account-menu"
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Log out" />
        </MenuItem>
      </Menu>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3, md: 5 }, pt: { xs: 10, md: 5 }, pb: { xs: 6, md: 6 } }}>
        <Box sx={{ maxWidth: 1180, mx: 'auto', display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
