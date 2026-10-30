import { useEffect, useState } from 'react';
import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';

import { ANIMATION_FADE } from '../consts';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const layer = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

// An image that either cuts or crossfades to each new src.
// To avoid flicker, each src is decoded before it's shown, and the top <img> element is
// only replaced (to restart the fade animation) when fading; a cut just changes its src.
export default function FadeImage({ src, fade, alt }) {
  const [layers, setLayers] = useState({ under: null, over: src, fadeId: 0 });

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = src;
    img.decode()
      .catch(() => {}) // Show it anyway; the <img> will deal with a broken image
      .then(() => {
        if (cancelled) return;
        setLayers((current) => {
          if (current.over === src) return current;
          return fade
            ? { under: current.over, over: src, fadeId: current.fadeId + 1 }
            : { under: null, over: src, fadeId: current.fadeId };
        });
      });
    return () => { cancelled = true; };
  }, [src, fade]);

  return (
    <>
      {layers.under && <Box component="img" src={layers.under} alt="" sx={layer} />}
      <Box
        component="img"
        key={layers.fadeId}
        src={layers.over}
        alt={alt}
        sx={{ ...layer, animation: layers.under ? `${fadeIn} ${ANIMATION_FADE}ms ease-in-out` : 'none' }}
        onAnimationEnd={() => setLayers(current => ({ ...current, under: null }))}
      />
    </>
  );
}
