export default function RobotLogo({ size = 30, borderRadius = 9, fontSize = 15, glowSize = 16 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius,
      background: 'linear-gradient(135deg, var(--blue), var(--purple))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 ${glowSize}px rgba(77,159,255,0.4)`,
      fontSize,
      overflow: 'hidden',
    }}>
      <span style={{ animation: 'robot-dance 2.4s ease-in-out infinite', display: 'inline-block', lineHeight: 1 }}>
        🤖
      </span>
    </div>
  );
}
