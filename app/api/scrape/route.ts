import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(req: Request) {
  try {
    const { url, storeType } = await req.json();
    
    // Verificar se a URL foi fornecida
    if (!url) {
      return NextResponse.json({ error: 'URL não fornecida' }, { status: 400 });
    }
    
    console.log(`Iniciando scraping da URL: ${url}, Tipo de loja: ${storeType || 'não especificado'}`);
    
    // Verificar se a URL é válida
    try {
      new URL(url);
    } catch (e) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }
    
    // Iniciar o navegador Puppeteer
    const browser = await puppeteer.launch({
      headless: true, // Usar o modo headless
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    try {
      // Abrir uma nova página
      const page = await browser.newPage();
      
      // Configurar o user-agent para evitar bloqueios
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      // Configurar viewport
      await page.setViewport({ width: 1280, height: 800 });
      
      console.log('Navegando para a URL...');
      
      // Navegar para a URL
      await page.goto(url, { 
        waitUntil: 'networkidle2', // Esperar até que a rede esteja inativa
        timeout: 60000 // Timeout de 60 segundos
      });
      
      console.log('Página carregada, iniciando extração de dados...');
      
      // Extrair preço do produto usando diferentes métodos
      let price = '';
      
      // Método 1: Extrair preço de lojas VTEX (prioridade se o tipo de loja for VTEX)
      if (storeType === 'vtex' || url.includes('vtex') || await page.evaluate(() => window.location.href.includes('vtex'))) {
        console.log('Detectada loja VTEX, usando métodos específicos de extração...');
        
        // Método 1.1: Extrair do objeto global __RUNTIME__ do VTEX
        price = await page.evaluate(() => {
          try {
            // @ts-ignore - O objeto __RUNTIME__ é específico do VTEX
            if (window.__RUNTIME__) {
              // @ts-ignore
              const productData = window.__RUNTIME__.route?.product;
              if (productData) {
                const items = productData.items || [];
                if (items.length > 0) {
                  const sellers = items[0].sellers || [];
                  if (sellers.length > 0) {
                    const commertialOffer = sellers[0].commertialOffer;
                    if (commertialOffer && commertialOffer.Price) {
                      return commertialOffer.Price.toString();
                    }
                  }
                }
              }
            }
            return '';
          } catch (e) {
            console.error('Erro ao extrair preço do __RUNTIME__:', e);
            return '';
          }
        });
        
        console.log('Preço extraído do __RUNTIME__:', price);
        
        // Método 1.2: Extrair do dataLayer (Google Tag Manager)
        if (!price) {
          price = await page.evaluate(() => {
            try {
              // Definir interface para o window com dataLayer
              interface WindowWithDataLayer extends Window {
                dataLayer?: any[];
              }
              
              // Cast window para o tipo com dataLayer
              const windowWithDataLayer = window as WindowWithDataLayer;
              
              if (windowWithDataLayer.dataLayer && windowWithDataLayer.dataLayer.length > 0) {
                for (const item of windowWithDataLayer.dataLayer) {
                  if (item.event === 'productView' || item.event === 'productDetail' || item.event === 'productImpression') {
                    if (item.ecommerce?.detail?.products?.[0]?.price) {
                      return item.ecommerce.detail.products[0].price.toString();
                    }
                    if (item.ecommerce?.impressions?.[0]?.price) {
                      return item.ecommerce.impressions[0].price.toString();
                    }
                  }
                }
              }
              return '';
            } catch (e) {
              console.error('Erro ao extrair preço do dataLayer:', e);
              return '';
            }
          });
          
          console.log('Preço extraído do dataLayer:', price);
        }
        
        // Método 1.3: Extrair usando seletores específicos do VTEX
        if (!price) {
          const vtexSelectors = [
            '.vtex-product-price-1-x-sellingPrice .vtex-product-price-1-x-currencyContainer',
            '.vtex-product-price-1-x-sellingPriceValue',
            '.vtex-store-components-3-x-price_sellingPrice',
            '.vtex-product-price-1-x-sellingPrice',
            '.price-best-price',
            '.skuBestPrice',
            '#product-price .skuBestPrice',
            '.productPrice .skuBestPrice',
            '.valor-por .skuPrice',
            '.preco-a-vista .skuPrice'
          ];
          
          for (const selector of vtexSelectors) {
            try {
              const priceElement = await page.$(selector);
              if (priceElement) {
                const priceText = await page.evaluate(el => el.textContent, priceElement);
                if (priceText) {
                  price = priceText.trim();
                  console.log(`Preço extraído do seletor ${selector}:`, price);
                  break;
                }
              }
            } catch (e) {
              console.error(`Erro ao extrair preço do seletor ${selector}:`, e);
            }
          }
        }
        
        // Método 1.4: Extrair de elementos com atributos data-price ou itemprop="price"
        if (!price) {
          price = await page.evaluate(() => {
            const priceElements = document.querySelectorAll('[data-price], [itemprop="price"]');
            for (const element of priceElements) {
              if (element.getAttribute('data-price')) {
                return element.getAttribute('data-price') || '';
              }
              if (element.getAttribute('content')) {
                return element.getAttribute('content') || '';
              }
              if (element.textContent) {
                return element.textContent.trim();
              }
            }
            return '';
          });
          
          console.log('Preço extraído de atributos data-price/itemprop:', price);
        }
      }
      
      // Método 2: Seletores genéricos para qualquer loja (fallback)
      if (!price) {
        console.log('Usando seletores genéricos para extração de preço...');
        
        const genericSelectors = [
          '.product-price .price',
          '.product-price .current-price',
          '.product-price .sale-price',
          '.price-box .price',
          '.price-box .special-price',
          '.product__price',
          '.product-single__price',
          '.product-price',
          '.price',
          '[data-product-price]',
          '.regular-price'
        ];
        
        for (const selector of genericSelectors) {
          try {
            const priceElement = await page.$(selector);
            if (priceElement) {
              const priceText = await page.evaluate(el => el.textContent, priceElement);
              if (priceText) {
                price = priceText.trim();
                console.log(`Preço extraído do seletor genérico ${selector}:`, price);
                break;
              }
            }
          } catch (e) {
            console.error(`Erro ao extrair preço do seletor genérico ${selector}:`, e);
          }
        }
      }
      
      // Método 3: Buscar por padrões de preço no HTML (último recurso)
      if (!price) {
        console.log('Buscando por padrões de preço no HTML...');
        
        price = await page.evaluate(() => {
          // Função para encontrar elementos que parecem conter preços
          const findPriceElements = () => {
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
          
          return findPriceElements();
        });
        
        console.log('Preço extraído por padrão de texto:', price);
      }
      
      console.log('Preço final extraído:', price);
      
      // Extrair dados do produto usando avaliação de JavaScript no navegador
      const productData = await page.evaluate(() => {
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
            '.product-single__title'
          ],
          price: [
            '.product-price .best-price', 
            '.product-price .price', 
            '.price-box .price',
            '.product__price', 
            '[data-price]', 
            '[itemprop="price"]', 
            '.price'
          ],
          description: [
            '.product-description', 
            '.product__description', 
            '[itemprop="description"]',
            '.description',
            '#description',
            '.product-details',
            // Adicionando seletores específicos para lojas VTEX
            '.vtex-store-components-3-x-productDescriptionText',
            '.vtex-store-components-3-x-productDescription',
            '.vtex-product-description-0-x-container',
            '.vtex-product-description-0-x-content',
            '.vtex-product-description-0-x-text',
            '.vtex-product-summary-2-x-description',
            '.productDescription',
            '.product-specification',
            '.product-specification-content',
            '.product-details-content',
            // Seletores mais genéricos que podem conter descrições
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
            '.swiper-slide img'
          ]
        };
        
        // Extrair descrição do produto usando métodos específicos para VTEX
        const extractVtexDescription = (returnHtml: boolean = false): string => {
          try {
            // Método 1: Extrair do objeto global __RUNTIME__ do VTEX
            // @ts-ignore - O objeto __RUNTIME__ é específico do VTEX
            if (window.__RUNTIME__) {
              // @ts-ignore
              const productData = window.__RUNTIME__.route?.product;
              if (productData && productData.description) {
                return productData.description;
              }
            }
            
            // Método 2: Extrair do dataLayer (Google Tag Manager)
            interface WindowWithDataLayer extends Window {
              dataLayer?: any[];
            }
            
            const windowWithDataLayer = window as WindowWithDataLayer;
            
            if (windowWithDataLayer.dataLayer && windowWithDataLayer.dataLayer.length > 0) {
              for (const item of windowWithDataLayer.dataLayer) {
                if (item.event === 'productView' || item.event === 'productDetail') {
                  if (item.ecommerce?.detail?.products?.[0]?.description) {
                    return item.ecommerce.detail.products[0].description;
                  }
                }
              }
            }
            
            // Método 3: Buscar em elementos com atributos específicos
            const descriptionElements = document.querySelectorAll('[data-specification="description"], [data-attribute="description"], [itemprop="description"]');
            for (const element of descriptionElements) {
              if (returnHtml) {
                return element.innerHTML;
              } else if (element.textContent) {
                return element.textContent.trim();
              }
            }
            
            // Método 4: Buscar em elementos com conteúdo de texto que pareça uma descrição
            const potentialDescriptionContainers = document.querySelectorAll('.tab-content, .product-tabs, .product-details');
            for (const container of potentialDescriptionContainers) {
              const tabs = container.querySelectorAll('.tab, .tab-pane, .panel');
              for (const tab of tabs) {
                const tabTitle = tab.querySelector('h2, h3, .title, .tab-title');
                if (tabTitle && tabTitle.textContent) {
                  const titleText = tabTitle.textContent.toLowerCase();
                  if (titleText.includes('descrição') || titleText.includes('detalhes') || titleText.includes('sobre') || titleText.includes('description')) {
                    const content = tab.querySelector('.content, .tab-content, .panel-content');
                    if (content) {
                      if (returnHtml) {
                        return content.innerHTML;
                      } else if (content.textContent) {
                        return content.textContent.trim();
                      }
                    }
                  }
                }
              }
            }
            
            return '';
          } catch (e) {
            console.error('Erro ao extrair descrição específica do VTEX:', e);
            return '';
          }
        };
        
        // Tentar extrair descrição usando métodos específicos para VTEX primeiro
        const vtexDescriptionText = extractVtexDescription(false);
        const vtexDescriptionHtml = extractVtexDescription(true);
        
        // Combinar com os métodos genéricos
        const descriptionText = vtexDescriptionText || extractText(selectors.description);
        const descriptionHtml = vtexDescriptionHtml || extractHtml(selectors.description);
        
        return {
          title: extractText(selectors.title),
          price: extractText(selectors.price),
          description: descriptionText,
          descriptionHtml: descriptionHtml,
          images: extractImages(selectors.images)
        };
      });
      
      // Extrair descrição adicional do produto se ainda não foi encontrada
      if (!productData.description) {
        try {
          // Tentar encontrar e clicar em abas ou botões que possam revelar a descrição
          const descriptionTabs = await page.$$('[data-tab="description"], .description-tab, #tab-description, [data-target="#description"]');
          
          if (descriptionTabs.length > 0) {
            await descriptionTabs[0].click();
            // Usar setTimeout em vez de waitForTimeout
            await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar a descrição aparecer
            
            // Tentar extrair a descrição novamente após clicar na aba
            const descriptionResult = await page.evaluate(() => {
              const descriptionElements = document.querySelectorAll('.product-description, #description, .description-content, .tab-content');
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
            
            productData.description = descriptionResult.text;
            productData.descriptionHtml = descriptionResult.html;
          }
        } catch (e) {
          console.error('Erro ao tentar extrair descrição adicional:', e);
        }
      }
      
      // Criar objeto com os dados processados
      const processedData = {
        title: productData.title || '',
        price: price || productData.price || '',  // Usar o preço extraído anteriormente como prioridade
        description: productData.description || '',
        descriptionHtml: productData.descriptionHtml || productData.description || '',
        images: productData.images || []
      };
      
      console.log('Dados processados:', processedData);
      
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
      
      console.log('Dados processados com sucesso');
      
      return NextResponse.json(processedData);
      
    } catch (error) {
      console.error('Erro durante o scraping:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Erro durante o scraping' },
        { status: 500 }
      );
    } finally {
      // Fechar o navegador
      await browser.close();
      console.log('Navegador fechado');
    }
    
  } catch (error) {
    console.error('Erro ao processar a requisição:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar a requisição' },
      { status: 500 }
    );
  }
}
