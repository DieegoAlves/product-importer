import { Scraper } from './types';
import { VtexScraper } from './vtex-scraper';
import { MercadoLivreScraper } from './mercadolivre-scraper';
import { GenericScraper } from './generic-scraper';

export class ScraperFactory {
  static getScraper(storeType: string, url: string): Scraper {
    // Verificar o tipo de loja especificado
    if (storeType === 'vtex' || url.includes('vtex')) {
      return new VtexScraper();
    } else if (storeType === 'mercadolivre' || url.includes('mercadolivre') || url.includes('mercadolibre') || url.includes('mercadolivre.com') || url.includes('mercadolibre.com') || url.includes('ml.com')) {
      return new MercadoLivreScraper();
    } else {
      return new GenericScraper();
    }
  }
}
