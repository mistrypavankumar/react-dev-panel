// react-dev-panel renders inside the host's MUI ThemeProvider. Many hosts (including the
// Minimals-based daxwell theme) register a tinted `soft` Chip variant. Declare it so our chips
// type-check; at runtime it renders soft when the host theme defines it, and falls back to a
// plain chip otherwise.
import '@mui/material/Chip';

declare module '@mui/material/Chip' {
  interface ChipPropsVariantOverrides {
    soft: true;
  }
}
