/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Remove X-Powered-By header
  poweredByHeader: false,

  images: {
    // Allow Supabase storage URLs for next/image optimization
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // Security headers applied to every response
  async headers() {
    return [
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
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + Supabase storage + Razorpay logos + tracking pixels + avatar service
              "img-src 'self' data: blob: https://*.supabase.co https://checkout.razorpay.com https://lumberjack.razorpay.com https://ui-avatars.com",
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
    ];
  },
};

export default nextConfig;
