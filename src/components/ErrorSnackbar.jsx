import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

export default function ErrorSnackbar({ message, actionLabel, onAction, onClose }) {
  return (
    <Snackbar
      open={!!message}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={20000}
      onClose={(event, reason) => reason !== 'clickaway' && onClose()}
      message={message}
      action={<Button color="secondary" size="small" onClick={onAction}>{actionLabel}</Button>}
    />
  );
}
