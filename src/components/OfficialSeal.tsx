import React from 'react';

interface OfficialSealProps {
  size?: 'sm' | 'md' | 'lg';
  monochrome?: boolean;
  className?: string;
  serialNumber?: string;
}

export const OfficialSeal: React.FC<OfficialSealProps> = ({
  size = 'md',
  monochrome = false,
  className = '',
  serialNumber,
}) => {
  const sizeMap = {
    sm: 'w-24 h-24 text-[9px]',
    md: 'w-32 h-32 text-[11px]',
    lg: 'w-36 h-36 text-[12px]',
  };

  // Official ink colors (blue/cyan or thermal black)
  const inkColor = monochrome ? '#000000' : '#1e40af';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none rotate-[-2deg] ${sizeMap[size]} ${className}`}
      title="الختم الرسمي - إدارة أ. أحمد محمد حامد"
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-xs"
        style={{ filter: monochrome ? 'none' : 'contrast(1.15)' }}
      >
        <defs>
          <path id="sealTopPath" d="M 24,100 A 76,76 0 1,1 176,100" fill="none" />
          <path id="sealBottomPath" d="M 176,100 A 76,76 0 0,1 24,100" fill="none" />
        </defs>

        {/* Outer serrated notched circle */}
        <circle
          cx="100"
          cy="100"
          r="93"
          fill="none"
          stroke={inkColor}
          strokeWidth="3"
          strokeDasharray="4 2"
        />

        {/* Inner solid border */}
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke={inkColor}
          strokeWidth="2"
        />

        {/* Core circle */}
        <circle
          cx="100"
          cy="100"
          r="54"
          fill="none"
          stroke={inkColor}
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />

        {/* Upper curved text: عالم الصوت والإلكترونيات */}
        <text
          fill={inkColor}
          fontSize="13"
          fontWeight="900"
          fontFamily="Cairo, sans-serif"
          letterSpacing="1"
        >
          <textPath href="#sealTopPath" startOffset="50%" textAnchor="middle">
            ★ عالم الصوت والإلكترونيات ★
          </textPath>
        </text>

        {/* Lower curved text: هاتف: 01005168499 */}
        <text
          fill={inkColor}
          fontSize="11"
          fontWeight="bold"
          fontFamily="Cairo, sans-serif"
          letterSpacing="0.5"
        >
          <textPath href="#sealBottomPath" startOffset="50%" textAnchor="middle">
            • 01005168499 • صيانة وتجارة
          </textPath>
        </text>

        {/* Center content (WITHOUT the word 'معتمد' as requested) */}
        <g transform="translate(100, 100)">
          {/* Inner badge box */}
          <rect
            x="-44"
            y="-22"
            width="88"
            height="26"
            rx="5"
            fill="none"
            stroke={inkColor}
            strokeWidth="1.6"
          />

          {/* Central shop specialty title */}
          <text
            x="0"
            y="-4"
            textAnchor="middle"
            fill={inkColor}
            fontSize="12.5"
            fontWeight="bold"
            fontFamily="Cairo, sans-serif"
            letterSpacing="0.8"
          >
            صوتيات وإلكترونيات
          </text>

          {/* Manager name */}
          <text
            x="0"
            y="17"
            textAnchor="middle"
            fill={inkColor}
            fontSize="9.5"
            fontWeight="900"
            fontFamily="Cairo, sans-serif"
          >
            إدارة: أ. أحمد محمد حامد
          </text>

          {/* Serial number */}
          <text
            x="0"
            y="30"
            textAnchor="middle"
            fill={inkColor}
            fontSize="7"
            fontFamily="monospace"
            letterSpacing="1"
          >
            {serialNumber || 'OFFICIAL STORE'}
          </text>

          {/* Small acoustic sound waves graphic */}
          <path
            d="M -16, -28 Q -8, -34 0, -28 Q 8, -22 16, -28"
            fill="none"
            stroke={inkColor}
            strokeWidth="1.4"
          />
        </g>
      </svg>
    </div>
  );
};
