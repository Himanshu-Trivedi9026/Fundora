/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Remove X-Powered-By header
  poweredByHeader: false,

  images: {
    // Allow Supabase storage URLs + ui-avatars.com for next/image optimization
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // Security headers and caching applied to responses
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      // Only cache immutable static assets in production — in dev this breaks HMR/Fast Refresh
      ...(isProd
        ? [
            {
              source: "/_next/static/(.*)",
              headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
              ],
            },
          ]
        : []),
      {
        // Cache logo for 1 day
        source: "/logo.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // In development, the Next.js dev server serves its own scripts
      // (e.g. _clientMiddlewareManifest.js) with non-standard MIME types
      // and relies on eval/inline for HMR. Apply CSP only in production.
      ...(isProd
        ? [
            {
              // Apply to all routes
              source: "/(.*)",
              headers: [
                {
                  key: "X-Frame-Options",
                  value: "DENY",
                },
                {
                  key: "X-Content-Type-Options",
                  value: "nosniff",
                },
                {
                  key: "Referrer-Policy",
                  value: "strict-origin-when-cross-origin",
                },
                {
                  key: "X-XSS-Protection",
                  value: "1; mode=block",
                },
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
                {
                  key: "Permissions-Policy",
                  value: "camera=(), microphone=(), geolocation=()",
                },
                {
                  key: "Content-Security-Policy",
                  value: [
                    "default-src 'self'",
                    // Razorpay checkout + risk detection + Supabase; 'unsafe-inline' needed for Razorpay dynamic scripts
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://rzp.razorpay.com https://cdn.razorpay.com https://js.cx",
                    // Fonts
                    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
                    // Images: self + Supabase storage + Razorpay logos + tracking pixels + avatar service
                    "img-src 'self' data: blob: https://*.supabase.co https://checkout.razorpay.com https://lumberjack.razorpay.com https://ui-avatars.com https://images.unsplash.com",
                    // API connections: Supabase (HTTPS + WSS realtime) + Razorpay + OpenRouter + OpenAI
                    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openrouter.ai https://api.openai.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://api.razorpay.com https://rzp.razorpay.com",
                    // Frames: Razorpay checkout + payment verification iframe
                    "frame-src https://checkout.razorpay.com https://api.razorpay.com",
                    // Styles
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                  ].join("; "),
                },
              ],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
