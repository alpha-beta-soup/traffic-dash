import { useEffect, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';

import useNow from '../hooks/useNow';
import { SIGN_PAGE_TIME } from '../map/layers';
import { drawSignPage, signPages, signSize } from '../utils';

// A message sign drawn as its LED board (utils/ledSign), as on the map. Signs with several
// pages step through them on a shared clock, so every sign on screen changes together.
export default function LedSign({ message, label }) {
  const canvas = useRef(null);
  const pages = useMemo(() => signPages(message), [message]);
  const images = useMemo(() => {
    const size = signSize(pages);
    return pages.map(lines => drawSignPage(lines, size));
  }, [pages]);
  const now = useNow(250); // Often enough that every sign's page changes at about the same moment
  const page = images.length ? Math.floor(now / SIGN_PAGE_TIME) % images.length : 0;

  useEffect(() => {
    const image = images[page];
    if (!image || !canvas.current) return;
    canvas.current.width = image.width;
    canvas.current.height = image.height;
    canvas.current.getContext('2d').putImageData(image, 0, 0);
  }, [images, page]);

  if (!images.length) return null;
  // Drawn at twice the size it shows, for sharp dots
  return (
    <Box
      component="canvas"
      ref={canvas}
      role="img"
      aria-label={`${label}: ${pages.map(lines => lines.map(({ left, right }) => [left, right].filter(Boolean).join(' ')).join(' / ')).join(' — ')}`}
      sx={{ display: 'block', maxWidth: '100%', width: images[0].width / 2 }}
    />
  );
}
