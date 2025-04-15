import { Page } from 'puppeteer';

export interface ProductData {
  title: string;
  price: string;
  description: string;
  descriptionHtml: string;
  images: string[];
}

export interface Scraper {
  scrape(page: Page, url: string): Promise<ProductData>;
}
