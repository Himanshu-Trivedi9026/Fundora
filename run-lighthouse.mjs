import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';

const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium-browser';
const URLS = [
  { name: 'Home', url: 'http://localhost:3000/home' },
  { name: 'Explore', url: 'http://localhost:3000/explore' },
  { name: 'Project Details', url: 'http://localhost:3000/projects/00000000-0000-0000-0000-000000000001' },
  { name: 'Creator Analytics', url: 'http://localhost:3000/creator/analytics' },
];

async function run() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--remote-debugging-address=127.0.0.1',
    ],
  });

  const port = new URL(browser.wsEndpoint()).port;
  console.log('Chrome running on port ' + port);

  const results = [];
  for (const { name, url } of URLS) {
    console.log('\n--- Auditing: ' + name + ' ---');
    const page = await browser.newPage();
    try {
      const { lhr } = await lighthouse(url, {
        port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      });
      const cats = lhr.categories;
      const r = {
        name,
        url,
        performance: Math.round(cats.performance.score * 100),
        accessibility: Math.round(cats.accessibility.score * 100),
        bestPractices: Math.round(cats['best-practices'].score * 100),
        seo: Math.round(cats.seo.score * 100),
        metrics: {
          FCP: lhr.audits['first-contentful-paint']?.displayValue,
          LCP: lhr.audits['largest-contentful-paint']?.displayValue,
          TBT: lhr.audits['total-blocking-time']?.displayValue,
          CLS: lhr.audits['cumulative-layout-shift']?.displayValue,
          SI: lhr.audits['speed-index']?.displayValue,
        },
        opportunities: Object.values(lhr.audits)
          .filter(a => a.details?.type === 'opportunity' && a.score !== null && a.score < 1)
          .map(a => ({ title: a.title, savings: a.displayValue, description: a.description }))
          .slice(0, 5),
      };
      results.push(r);
      console.log('  Perf: ' + r.performance + ' | A11y: ' + r.accessibility + ' | BP: ' + r.bestPractices + ' | SEO: ' + r.seo);
      console.log('  FCP: ' + r.metrics.FCP + ' | LCP: ' + r.metrics.LCP + ' | TBT: ' + r.metrics.TBT + ' | CLS: ' + r.metrics.CLS);
    } catch (err) {
      console.error('  ERROR: ' + err.message);
      results.push({ name, url, error: err.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n\n========== LIGHTHOUSE RESULTS ==========\n');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
