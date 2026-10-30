import Button from '@mui/material/Button';

// A button that is filled when on
export default function ToggleButton({ on, onClick, disabled, offVariant = 'text', children }) {
  return (
    <Button
      size="small"
      variant={on ? 'contained' : offVariant}
      disableElevation
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
