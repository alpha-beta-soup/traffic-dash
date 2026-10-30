import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

export const DEFAULT_LAYERS = Object.freeze({ labels: true, signs: true, events: true, traffic: true });

// Which optional map layers to show; 'traffic' is offered only when traffic data is available
export default function LayersMenu({ layers, onChange, traffic }) {
  const [anchor, setAnchor] = useState(null);
  const options = [
    ['labels', 'Camera labels'],
    ['signs', 'Message signs'],
    ['events', 'Road events'],
    ...(traffic ? [['traffic', 'Congestion']] : []),
  ];
  return (
    <>
      <Button
        variant="contained"
        size="small"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={e => setAnchor(e.currentTarget)}
        sx={{ opacity: 0.85 }}
      >
        Layers
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {options.map(([key, label]) => (
          <MenuItem
            key={key}
            dense
            role="menuitemcheckbox"
            aria-checked={layers[key]}
            onClick={() => onChange({ ...layers, [key]: !layers[key] })}
          >
            <Checkbox size="small" checked={layers[key]} tabIndex={-1} disableRipple sx={{ p: 0, mr: 1 }} />
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
