import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'VroomX TMS'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow behind content */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '800px',
            height: '400px',
            background:
              'radial-gradient(ellipse at center, rgba(25,35,52,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #192334 0%, #2a3a4f 50%, #192334 100%)',
          }}
        />

        {/* Logo mark — orange square + wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '10px',
              background: '#192334',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: '26px', fontWeight: 800 }}>V</span>
          </div>
          <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            VroomX
          </span>
        </div>

        {/* Main headline */}
        <div
          style={{
            color: '#ffffff',
            fontSize: '64px',
            fontWeight: 800,
            letterSpacing: '-1.5px',
            lineHeight: 1.1,
            textAlign: 'center',
            maxWidth: '900px',
            padding: '0 48px',
          }}
        >
          Transportation Management
          <br />
          <span style={{ color: '#192334' }}>Built for Carriers</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: '#a1a1aa',
            fontSize: '24px',
            fontWeight: 400,
            marginTop: '24px',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
          }}
        >
          Clean Gross on every load. Automated driver settlements.
          Per-truck profitability. From $29/mo.
        </div>

        {/* Badge row */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '40px',
          }}
        >
          {['14-Day Free Trial', 'No Credit Card', 'No Per-Seat Fees'].map((label) => (
            <div
              key={label}
              style={{
                background: 'rgba(25,35,52,0.1)',
                border: '1px solid rgba(25,35,52,0.3)',
                borderRadius: '9999px',
                padding: '8px 20px',
                color: '#192334',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Bottom domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            color: '#52525b',
            fontSize: '16px',
            fontWeight: 500,
            letterSpacing: '0.05em',
          }}
        >
          vroomx.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
