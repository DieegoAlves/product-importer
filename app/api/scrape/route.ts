import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { ScraperFactory } from '../../lib/scrapers/scraper-factory';

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
      headless: true, // Use headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process'
      ],
      executablePath: process.env.NODE_ENV === 'production' 
        ? process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
        : puppeteer.executablePath()
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
      
      // Obter o scraper apropriado para o tipo de loja
      const scraper = ScraperFactory.getScraper(storeType, url);
      
      // Extrair dados do produto usando o scraper
      const processedData = await scraper.scrape(page, url);
      
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
