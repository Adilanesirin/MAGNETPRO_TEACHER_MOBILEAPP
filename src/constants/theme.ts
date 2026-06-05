export const theme = {
  colors: {
    primary: '#1A6D82', // Deep Teal Blue
    primaryLight: '#2A8CA5',
    secondary: '#D9534F', // Soft Coral/Red
    background: '#F4F7F8', // Off-white/Light Gray
    card: '#FFFFFF', // White cards
    text: '#2D3748', // Dark Gray
    textSecondary: '#718096', // Slate
    border: '#E2E8F0', // Light Gray border
    success: '#38A169', // Green for Present
    danger: '#E53E3E', // Red for Absent
    warning: '#D69E2E', // Yellow for Half-Day
    info: '#3182CE', // Blue for Info
    holiday: '#DD6B20', // Orange for Holiday
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    s: 8,
    m: 12,
    l: 20,
    xl: 24,
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 4,
    },
  },
  typography: {
    fontFamily: {
      regular: 'System', 
      medium: 'System',
      bold: 'System',
    },
    sizes: {
      h1: 28,
      h2: 24,
      h3: 20,
      body: 16,
      subtext: 14,
      caption: 12,
    },
  },
};
