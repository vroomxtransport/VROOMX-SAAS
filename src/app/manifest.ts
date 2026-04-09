import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VroomX TMS',
    short_name: 'VroomX',
    description: 'Transportation Management System for auto-transport carriers',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f8f9fb',
    theme_color: '#192334',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/images/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/images/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/images/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
