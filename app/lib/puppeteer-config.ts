import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';

/**
 * Configures and launches Puppeteer with appropriate settings for both local development
 * and serverless environments like Vercel.
 */
export async function setupPuppeteer() {
  // Configure Chromium for serverless environments
  if (process.env.NODE_ENV === 'production') {
    // Use serverless-compatible configuration
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
      // @ts-ignore - ignoreHTTPSErrors is valid but TypeScript doesn't recognize it
      ignoreHTTPSErrors: true,
    });
  } else {
    // Use standard configuration for local development
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
}
