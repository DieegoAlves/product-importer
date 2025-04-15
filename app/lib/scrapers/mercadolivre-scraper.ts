import { Page } from 'puppeteer';
import { ProductData, Scraper } from './types';

export class MercadoLivreScraper implements Scraper {
  async scrape(page: Page, url: string): Promise<ProductData> {
    console.log('Iniciando scraping MercadoLivre da URL:', url);
    
    // Extrair dados do produto usando métodos específicos para MercadoLivre
    const productData = await this.extractProductData(page);
    
    // Extrair descrição completa do produto (MercadoLivre carrega a descrição via AJAX)
    await this.extractFullDescription(page, productData, url);
    
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
    
    console.log('Dados MercadoLivre processados com sucesso');
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
      const extractImages = (): string[] => {
        const images: string[] = [];
        
        // Tentar obter imagens do carrossel principal
        try {
          // Método 1: Obter do script de dados do produto
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            if (script.textContent && script.textContent.includes('"thumbnail":')) {
              const matches = script.textContent.match(/"picture":"([^"]+)"/g);
              if (matches && matches.length > 0) {
                for (const match of matches) {
                  const url = match.replace('"picture":"', '').replace('"', '');
                  // Substituir tamanho da imagem para obter a versão de alta resolução
                  const highResUrl = url.replace(/\-[A-Z]\.(jpg|png|jpeg)/i, '-O.$1');
                  images.push(highResUrl);
                }
                if (images.length > 0) return images;
              }
            }
          }
          
          // Método 2: Obter diretamente das tags de imagem
          const imageSelectors = [
            '.ui-pdp-gallery__figure img',
            '.ui-pdp-image',
            '.ui-pdp-thumbnail__image',
            '.slick-slide img'
          ];
          
          for (const selector of imageSelectors) {
            const imgElements = document.querySelectorAll(selector);
            if (imgElements.length > 0) {
              imgElements.forEach(img => {
                // Tentar obter a URL da imagem em alta resolução
                const src = img.getAttribute('data-zoom') || 
                          img.getAttribute('src') || 
                          img.getAttribute('data-src');
                
                if (src && !images.includes(src) && !src.includes('data:image')) {
                  // Substituir tamanho da imagem para obter a versão de alta resolução
                  const highResUrl = src.replace(/\-[A-Z]\.(jpg|png|jpeg)/i, '-O.$1');
                  images.push(highResUrl);
                }
              });
              
              if (images.length > 0) return images;
            }
          }
        } catch (e) {
          console.error('Erro ao extrair imagens:', e);
        }
        
        return images;
      };
      
      // Seletores específicos para MercadoLivre
      const selectors = {
        title: [
          '.ui-pdp-title',
          '.item-title h1',
          '.item-title',
          'h1.ui-pdp-title'
        ],
        price: [
          '.ui-pdp-price__second-line .andes-money-amount__fraction',
          '.price-tag-fraction',
          '.ui-pdp-price__part .andes-money-amount__fraction',
          '.ui-pdp-container .andes-money-amount__fraction'
        ],
        description: [
          '.ui-pdp-description__content',
          '.item-description .content',
          '#description .content',
          '.description-content'
        ]
      };
      
      // Extrair preço com centavos se disponível
      const extractFullPrice = (): string => {
        try {
          const fractionSelector = '.ui-pdp-price__second-line .andes-money-amount__fraction';
          const centsSelector = '.ui-pdp-price__second-line .andes-money-amount__cents';
          
          const fraction = document.querySelector(fractionSelector);
          const cents = document.querySelector(centsSelector);
          
          if (fraction && fraction.textContent) {
            let price = fraction.textContent.trim().replace(/\./g, '');
            
            if (cents && cents.textContent) {
              price += ',' + cents.textContent.trim();
            }
            
            return price;
          }
          
          // Fallback para outros seletores de preço
          return extractText(selectors.price);
        } catch (e) {
          console.error('Erro ao extrair preço completo:', e);
          return extractText(selectors.price);
        }
      };
      
      // Extrair dados do produto
      return {
        title: extractText(selectors.title),
        price: extractFullPrice(),
        description: extractText(selectors.description),
        descriptionHtml: extractHtml(selectors.description),
        images: extractImages()
      };
    });
  }

  private async extractFullDescription(page: Page, productData: any, url: string): Promise<void> {
    try {
      // MercadoLivre carrega a descrição via AJAX, então precisamos verificar se já temos uma descrição
      if (!productData.description || productData.description.length < 10) {
        console.log('Tentando obter descrição completa do MercadoLivre...');
        
        // Tentar encontrar o ID do produto na URL
        const itemIdMatch = url.match(/MLB-?(\d+)/i) || url.match(/\/p\/([^?/]+)/);
        let itemId = '';
        
        if (itemIdMatch && itemIdMatch[1]) {
          itemId = itemIdMatch[1];
        } else {
          // Tentar extrair o ID da página
          itemId = await page.evaluate(() => {
            // Procurar o ID nos scripts da página
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
              if (script.textContent) {
                const idMatch = script.textContent.match(/"item_id":"([^"]+)"/);
                if (idMatch && idMatch[1]) {
                  return idMatch[1];
                }
              }
            }
            return '';
          });
        }
        
        if (itemId) {
          console.log('ID do produto MercadoLivre encontrado:', itemId);
          
          // Rolar para a seção de descrição para garantir que seja carregada
          await page.evaluate(() => {
            const descriptionSection = document.querySelector('.ui-pdp-description');
            if (descriptionSection) {
              descriptionSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
          
          // Aguardar um momento para o carregamento da descrição
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Tentar extrair a descrição novamente
          const fullDescription = await page.evaluate(() => {
            const descriptionElements = document.querySelectorAll('.ui-pdp-description__content');
            for (const element of descriptionElements) {
              if (element) {
                return {
                  text: element.textContent ? element.textContent.trim() : '',
                  html: element.innerHTML
                };
              }
            }
            return { text: '', html: '' };
          });
          
          if (fullDescription.text && fullDescription.text.length > 0) {
            productData.description = fullDescription.text;
            productData.descriptionHtml = fullDescription.html;
            console.log('Descrição completa do MercadoLivre obtida com sucesso');
          }
        }
      }
    } catch (e) {
      console.error('Erro ao tentar extrair descrição completa do MercadoLivre:', e);
    }
  }
}
