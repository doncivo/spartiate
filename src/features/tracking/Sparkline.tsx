/**
 * SUIVIS-029 : courbe SVG simple (Recharts non importé, comme Progrès › Récupération), `role="img"` et étiquette textuelle fournie par l'appelant. Un
 * point null coupe la courbe (jamais une valeur inventée) ; échelle fixe facultative (notes de 1 à 10), sinon min–max des valeurs.
 */
export function Sparkline({ points, label, min, max }: { readonly points: readonly (number | null)[]; readonly label: string; readonly min?: number; readonly max?: number }) {
  const width = 120;
  const height = 32;
  const values = points.filter((v): v is number => v !== null);
  const lo = min ?? Math.min(...values);
  const span = (max ?? Math.max(...values)) - lo;
  const x = (i: number): number => (points.length <= 1 ? width / 2 : (i * width) / (points.length - 1));
  const y = (v: number): number => (span === 0 ? height / 2 : height - 3 - ((v - lo) * (height - 6)) / span);
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  points.forEach((v, i) => {
    if (v === null) {
      if (run.length > 0) runs.push(run);
      run = [];
    } else run.push([x(i), y(v)]);
  });
  if (run.length > 0) runs.push(run);
  return (
    <svg className="ct-tracking__chart" viewBox={`0 0 ${String(width)} ${String(height)}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {runs.map((r, i) => {
        const first = r[0];
        if (r.length === 1 && first) return <circle key={i} className="ct-tracking__dot" cx={first[0]} cy={first[1]} r={1.5} />;
        return <polyline key={i} className="ct-tracking__line" points={r.map(([px, py]) => `${String(px)},${String(py)}`).join(' ')} />;
      })}
    </svg>
  );
}
