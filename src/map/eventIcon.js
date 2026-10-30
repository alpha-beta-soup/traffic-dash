// Icons for road events, drawn like NZ road signs (see consts/eventImpacts)
const SIZE = 40; // Canvas px; 20 CSS px at pixelRatio 2

export default function eventIcon({ color, shape }) {
  const ctx = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }).getContext('2d');
  const c = SIZE / 2;
  if (shape === 'diamond') {
    // A warning diamond with a black border and an exclamation mark
    ctx.beginPath();
    ctx.moveTo(c, 2);
    ctx.lineTo(SIZE - 2, c);
    ctx.lineTo(c, SIZE - 2);
    ctx.lineTo(2, c);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1b1b1b';
    ctx.stroke();
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(c - 2, 10, 4, 13);
    ctx.beginPath();
    ctx.arc(c, 28, 2.4, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    // A circle with a white border: a no-entry bar, or an "i"
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'white';
    ctx.stroke();
    ctx.fillStyle = 'white';
    if (shape === 'no-entry') {
      ctx.fillRect(9, c - 3.5, SIZE - 18, 7);
    } else {
      ctx.fillRect(c - 2.5, 16, 5, 14);
      ctx.beginPath();
      ctx.arc(c, 11, 2.8, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  return ctx.getImageData(0, 0, SIZE, SIZE);
}
