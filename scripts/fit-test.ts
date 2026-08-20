import { fitText, overflowsAt } from '../src/video/fit';

const BOX = 1920 - 264; // frame minus the 132px gutters

const cases: [string, number][] = [
  ['Lenis provides a smooth, customizable scroll experience for modern web applications.', 78],
  ['Smooth scroll as it should be', 208],
  ['Janky scrolling?', 208],
  ['A tiny library for slugifying strings', 208],
  ['FRICTION', 560],
];

console.log('OLD (constant size, nothing measured):');
for (const [text, size] of cases) {
  const over = overflowsAt(text, size, BOX, 2);
  const est = Math.round(text.length * size * 0.55);
  console.log(
    `  ${over ? 'OVERFLOW' : 'ok      '} ${String(size).padStart(3)}px  est ${String(est).padStart(5)}px / ${BOX}px  "${text.slice(0, 40)}"`
  );
}

console.log('\nNEW (fitted):');
for (const [text, size] of cases) {
  const f = fitText(text, { boxWidth: BOX, ideal: size, maxLines: 3 });
  console.log(
    `  ${String(f.fontSize).padStart(3)}px  ${f.lines.length} line(s)  ${String(Math.round(f.width)).padStart(4)}/${BOX}px  ${JSON.stringify(f.lines)}`
  );
}
