const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ?? '',
        '*.vercel.app',
      ].filter(Boolean),
    },
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // Ensure source maps are not exposed in production
  productionBrowserSourceMaps: false,

  // Compress responses
  compress: true,

  // Power-by header removed for security
  poweredByHeader: false,
}