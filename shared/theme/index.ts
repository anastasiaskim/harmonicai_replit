import { createTheme, alpha } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#007AFF', // Apple's signature blue
      light: '#47A3FF',
      dark: '#0055B3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#5856D6', // Apple's purple
      light: '#7A79E0',
      dark: '#3E3D96',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#FF3B30', // Apple's red
      light: '#FF6961',
      dark: '#B22920',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#FF9500', // Apple's orange
      light: '#FFAA33',
      dark: '#B26800',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#5AC8FA', // Apple's light blue
      light: '#7DD3FB',
      dark: '#3F8CAF',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#34C759', // Apple's green
      light: '#5CD471',
      dark: '#248A3F',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F2F2F7', // Apple's system background
      paper: '#FFFFFF',
    },
    text: {
      primary: '#000000',
      secondary: '#3C3C43',
      disabled: '#8E8E93',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      'SF Pro Text',
      'SF Pro Display',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '-0.01em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: alpha('#000', 0.02),
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
  },
}); 