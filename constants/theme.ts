// Light and Dark color palettes
export const lightColors = {
  primary: '#FFFFFF',       // White background
  secondary: '#F5F7FA',     // Light gray for cards
  accent: '#EA5455',        // Professional red accent (same)
  text: {
    primary: '#1B2D45',     // Dark navy text
    secondary: '#4A5568',   // Medium gray text
    muted: '#718096'        // Light gray text
  },
  status: {
    success: '#2ECC71',
    warning: '#F1C40F',
    error: '#EA5455'
  },
  border: '#E2E8F0',
};

export const darkColors = {
  primary: '#1B2D45',       // Deep navy background
  secondary: '#2D4059',     // Lighter navy for cards
  accent: '#EA5455',        // Professional red accent
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B6BE',
    muted: '#8D96A7'
  },
  status: {
    success: '#2ECC71',
    warning: '#F1C40F',
    error: '#EA5455'
  },
  border: '#2D4059',
};

export const colors = darkColors; // Default to dark for backward compatibility

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  round: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5.84,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 7.84,
    elevation: 8,
  },
};

export const lightShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
};
