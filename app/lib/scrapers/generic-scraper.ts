import { Page } from 'puppeteer';
import { ProductData, Scraper } from './types';

export class GenericScraper implements Scraper {
  async scrape(page: Page, url: string): Promise<ProductData> {
    console.log('Iniciando scraping genérico da URL:', url);
    
    // Extrair dados do produto usando avaliação de JavaScript no navegador
    const productData = await this.extractProductData(page);
    
    // Criar objeto com os dados processados
    const processedData: ProductData = {
      title: productData.title || '',
      price: productData.price || '',
      description: productData.description || '',
      descriptionHtml: productData.descriptionHtml || productData.description || '',
      images: productData.images || []
    };
    
    // Limpar e formatar dados
    if (processedData.price) {
      // Remover caracteres não numéricos, exceto vírgula e ponto
      const cleanPrice = processedData.price.replace(/[^\d,.]/g, '');
      // Converter vírgula para ponto se necessário
      processedData.price = cleanPrice.replace(',', '.');
    }
    
    // Garantir que as URLs das imagens sejam absolutas
    processedData.images = processedData.images.map(img => {
      try {
        return new URL(img, url).href;
      } catch (e) {
        return img;
      }
    });
    
    console.log('Dados genéricos processados com sucesso');
    return processedData;
  }

  private async extractProductData(page: Page): Promise<any> {
    return page.evaluate(() => {
      // Função auxiliar para extrair texto com fallbacks
      const extractText = (selectors: string[]): string => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        return '';
      };

      // Função auxiliar para extrair HTML com fallbacks
      const extractHtml = (selectors: string[]): string => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.innerHTML;
          }
        }
        return '';
      };
      
      // Função para extrair imagens com fallbacks
      const extractImages = (selectors: string[]): string[] => {
        const images: string[] = [];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              // Verificar diferentes atributos de imagem
              const src = (el as HTMLImageElement).src || 
                         el.getAttribute('data-src') || 
                         el.getAttribute('data-lazy-src') ||
                         el.getAttribute('data-original');
                
              if (src && !src.includes('data:image')) {
                images.push(src);
              }
            });
            
            if (images.length > 0) break;
          }
        }
        
        return images;
      };
      
      // Seletores para diferentes elementos
      const selectors = {
        title: [
          'h1', 
          'h1.product-name', 
          '.product-title', 
          '.product-name', 
          '[itemprop="name"]',
          '.product__title',
          '.product-single__title',
          '.product-info h1',
          '.product-detail h1',
          '.product-essential h1'
        ],
        price: [
          '.product-price .price', 
          '.price-box .price',
          '.product__price', 
          '[data-price]', 
          '[itemprop="price"]', 
          '.price',
          '.product-info .price',
          '.product-essential .price',
          '.product-price',
          '.regular-price',
          '.special-price'
        ],
        description: [
          '.product-description', 
          '.product__description', 
          '[itemprop="description"]',
          '.description',
          '#description',
          '.product-details',
          '.product-info-main .description',
          '.product-info-main .value',
          '.product-info .description',
          '.product-essential .description',
          '.tab-content',
          '.product-info',
          '.product-details-wrapper'
        ],
        images: [
          '.product-image img', 
          '.product-gallery img', 
          '.product__image img',
          '[itemprop="image"]',
          '.product-image-gallery img',
          '.product-images img',
          '.swiper-slide img',
          '.gallery-image',
          '.product-image',
          '.product-photo-img',
          '.slick-slide img',
          '.carousel-item img'
        ]
      };
      
      // Buscar por padrões de preço no HTML (último recurso)
      const findPricePattern = (): string => {
        const priceRegex = /R\$\s*\d+[\.,]?\d*/i;
        const elements = Array.from(document.querySelectorAll('*'));
        
        for (const element of elements) {
          if (element.children.length === 0 && element.textContent) {
            const text = element.textContent.trim();
            if (priceRegex.test(text)) {
              return text;
            }
          }
        }
        
        return '';
      };
      
      // Extrair dados do produto
      const title = extractText(selectors.title);
      const price = extractText(selectors.price) || findPricePattern();
      const description = extractText(selectors.description);
      const descriptionHtml = extractHtml(selectors.description);
      const images = extractImages(selectors.images);
      
      return {
        title,
        price,
        description,
        descriptionHtml,
        images
      };
    });
  }
}
