import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import { Detail, timeFormat } from './EventDetails';
import { warningColour, warningTextColour } from '../utils';

const when = time => time && timeFormat.format(new Date(time));

// A MetService weather warning's details: what, where, what to do, and when. With the credit the
// feed's licence asks for.
export default function WarningDetails({ warning }) {
  return (
    <>
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: warningColour(warning) }} />
        MetService · {warning.colour ?? warning.severity}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.3 }}>
        {warning.headline}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {warning.areas.map(area => area.name).join('; ')}
      </Typography>
      {warning.description && (
        <Typography variant="body2" sx={{ color: 'text.primary', mt: 1 }}>{warning.description}</Typography>
      )}
      <Detail label="What to do">{warning.instruction?.replace(/^Action:\s*/, '')}</Detail>
      <Detail label="From">{when(warning.onset)}</Detail>
      <Detail label="Until">{when(warning.expires)}</Detail>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        From <Link href={warning.web ?? 'https://www.metservice.com/warnings/home'} target="_blank" rel="noopener">MetService</Link>
        {' '}(<Link href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</Link>)
      </Typography>
    </>
  );
}

// The colours of a warning chip: MetService's colour, with text that reads on it
export const warningChipColours = warning => ({ bgcolor: warningColour(warning), color: warningTextColour(warning) });
