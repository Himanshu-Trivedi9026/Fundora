import Head from "next/head";

/**
 * SEO component — adds production-ready meta tags to any page.
 *
 * Usage:
 *   <SEO
 *     title="Explore Projects"
 *     description="Discover innovative crowdfunding projects..."
 *     url="/explore"
 *   />
 *
 * Defaults:
 *   - title: "Fundora — Crowdfunding Reimagined"
 *   - description: "Fundora is an AI-powered crowdfunding platform..."
 *   - type: "website"
 *   - noindex: false
 */
export default function SEO({
  title,
  description = "Fundora is an AI-powered crowdfunding platform where creators, innovators, and communities unite to transform ideas into reality.",
  url,
  image = "/og-default.png",
  type = "website",
  noindex = false,
  nofollow = false,
  structuredData,
}) {
  const siteName = "Fundora";
  const fullTitle = title
    ? `${title} | ${siteName}`
    : `${siteName} — Crowdfunding Reimagined`;
  const canonicalUrl = url
    ? `https://fundora.vercel.app${url}`
    : "https://fundora.vercel.app";

  return (
    <Head>
      {/* ─── Primary ─── */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* ─── Robots ─── */}
      {(noindex || nofollow) && (
        <meta
          name="robots"
          content={`${noindex ? "noindex" : "index"}, ${nofollow ? "nofollow" : "follow"}`}
        />
      )}

      {/* ─── Open Graph ─── */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta
        property="og:image"
        content={`https://fundora.vercel.app${image}`}
      />

      {/* ─── Twitter Card ─── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta
        name="twitter:image"
        content={`https://fundora.vercel.app${image}`}
      />

      {/* ─── App Info ─── */}
      <meta name="application-name" content={siteName} />
      <meta name="theme-color" content="#7c3aed" />

      {/* ─── Structured Data ─── */}
      {structuredData && (
        <script
          type="application/ld+json"
          // Escape `<` so a title/description containing `</script><script>…`
          // can't break out of the JSON-LD block and execute (stored XSS).
          // JSON.stringify does not escape `<` by default.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      )}
    </Head>
  );
}
