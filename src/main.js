const OUTPUT_FOLDER = "public";

function sitemapXmlFromUrls(fullUrls) {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return (`
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ` + fullUrls.map((fullUrl) => `
        <url>
            <loc>${fullUrl}</loc>
            <lastmod>${dateStr}</lastmod>
        </url>
    `) + `
    </urlset>
  `);
}

