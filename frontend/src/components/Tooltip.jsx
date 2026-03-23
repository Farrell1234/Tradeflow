import { useState } from 'react';

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <span className="tooltip-trigger">?</span>
      )}
      {visible && (
        <span className="tooltip-box">{text}</span>
      )}
    </span>
  );
}
