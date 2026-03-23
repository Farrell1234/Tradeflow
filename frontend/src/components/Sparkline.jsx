import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

export default function Sparkline({ data = [], color = 'var(--green)' }) {
  if (!data || data.length < 2) {
    return <div style={{ height: 56 }} />;
  }

  const points = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sg-${color.replace(/[^a-z]/gi, '')})`}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          content={() => null}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
