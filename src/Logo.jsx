// CivicOS Logo — city hall silhouette (dome, pediment, columns, steps)
export default function Logo({ size = 40, text = true, light = false, textSize = '1.4rem' }) {
  const color  = '#2563eb'
  const txtClr = light ? '#ffffff' : '#1e3a8a'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {/* SVG city hall — viewBox 0 0 40 52 */}
      <svg
        width={size}
        height={Math.round(size * 52 / 40)}
        viewBox="0 0 40 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Flag pole */}
        <line x1="20" y1="2" x2="20" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        {/* Flag */}
        <polygon points="20,2 26,4.5 20,7" fill={color} opacity="0.8"/>

        {/* Dome */}
        <ellipse cx="20" cy="10" rx="7" ry="4" fill={color}/>
        <ellipse cx="20" cy="9" rx="6" ry="2.5" fill={color} opacity="0.6"/>

        {/* Pediment (triangle roof) */}
        <polygon points="4,22 20,12 36,22" fill={color}/>

        {/* Main building body */}
        <rect x="5" y="22" width="30" height="20" rx="0.5" fill={color}/>

        {/* Columns (5 vertical pillars) */}
        <rect x="7"  y="23" width="3" height="18" rx="1" fill="white" opacity="0.25"/>
        <rect x="13" y="23" width="3" height="18" rx="1" fill="white" opacity="0.25"/>
        <rect x="19" y="23" width="2" height="18" rx="1" fill="white" opacity="0.25"/>
        <rect x="24" y="23" width="3" height="18" rx="1" fill="white" opacity="0.25"/>
        <rect x="30" y="23" width="3" height="18" rx="1" fill="white" opacity="0.25"/>

        {/* Door */}
        <rect x="17" y="34" width="6" height="8" rx="1" fill="white" opacity="0.35"/>

        {/* Windows */}
        <rect x="8"  y="26" width="4" height="3" rx="0.5" fill="white" opacity="0.3"/>
        <rect x="28" y="26" width="4" height="3" rx="0.5" fill="white" opacity="0.3"/>
        <rect x="8"  y="31" width="4" height="3" rx="0.5" fill="white" opacity="0.3"/>
        <rect x="28" y="31" width="4" height="3" rx="0.5" fill="white" opacity="0.3"/>

        {/* Steps (3 tiers) */}
        <rect x="3"  y="42" width="34" height="3"  rx="0.5" fill={color} opacity="0.85"/>
        <rect x="1"  y="45" width="38" height="3"  rx="0.5" fill={color} opacity="0.7"/>
        <rect x="0"  y="48" width="40" height="4"  rx="0.5" fill={color} opacity="0.55"/>
      </svg>

      {text && (
        <span style={{
          fontSize:   textSize,
          fontWeight: 700,
          color:      txtClr,
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
        }}>
          CivicOS
        </span>
      )}
    </div>
  )
}
