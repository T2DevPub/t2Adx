import type { MetadataRoute } from 'next';

// Keep crawling allowed so crawlers can read the noindex response header/meta tag.
// Disallowing the whole site in robots.txt would prevent crawlers from seeing noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
  };
}
