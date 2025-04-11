import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function POST(req: Request) {
  try {
    // Obter dados da requisição
    const productData = await req.json();
    
    if (!productData) {
      return NextResponse.json({ error: 'Dados do produto não fornecidos' }, { status: 400 });
    }
    
    console.log('Dados do produto recebidos:', productData);
    
    // Obter credenciais do Shopify das variáveis de ambiente
    const shopifyDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyDomain || !accessToken) {
      console.error('Credenciais do Shopify não configuradas');
      return NextResponse.json(
        { error: 'Credenciais do Shopify não configuradas' },
        { status: 500 }
      );
    }
    
    // Remover qualquer protocolo ou barra do domínio
    const cleanDomain = shopifyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Preparar os dados para a API
    const title = productData.title || 'Produto Sem Título';
    const description = productData.description || '';
    
    // Garantir que o preço seja um valor numérico válido
    let price = '0.00';
    if (productData.price) {
      // Remover caracteres não numéricos, exceto ponto decimal
      const cleanPrice = productData.price.replace(/[^\d.,]/g, '').replace(',', '.');
      // Verificar se é um número válido
      const numericPrice = parseFloat(cleanPrice);
      if (!isNaN(numericPrice)) {
        price = numericPrice.toFixed(2);
      }
    }
    
    console.log('Preço formatado para API:', price);
    
    // Limitar a 10 imagens (o Shopify permite até 250, mas vamos limitar para performance)
    const productImages = productData.images || [];
    const limitedImages = productImages.slice(0, 10);
    
    console.log(`Processando ${limitedImages.length} imagens`);
    
    // Array para armazenar as imagens processadas
    const processedImages = [];
    
    // Processar cada imagem
    for (const imageUrl of limitedImages) {
      try {
        console.log(`Baixando imagem: ${imageUrl}`);
        
        // Baixar a imagem
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });
        
        if (!imageResponse.ok) {
          console.error(`Erro ao baixar imagem ${imageUrl}: ${imageResponse.status} ${imageResponse.statusText}`);
          continue;
        }
        
        // Converter para buffer e depois para base64
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        
        // Obter o nome do arquivo da URL
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0] || 'product-image.jpg';
        
        // Adicionar a imagem processada ao array
        processedImages.push({
          attachment: base64Image,
          filename: filename
        });
        
        console.log(`Imagem processada: ${filename}`);
        
      } catch (error) {
        console.error(`Erro ao processar imagem ${imageUrl}:`, error);
      }
    }
    
    console.log(`Total de ${processedImages.length} imagens processadas com sucesso`);
    
    // Definir a query GraphQL para criar o produto
    const query = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  inventoryQuantity
                  sku
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Preparar as variantes do produto
    let variants = [];
    if (productData.variants && Array.isArray(productData.variants) && productData.variants.length > 0) {
      // Se temos variantes definidas, usá-las
      variants = productData.variants.map((variant: {
        price?: string;
        sku?: string;
        inventory_quantity?: number;
        title?: string;
      }) => {
        // Garantir que o preço da variante seja um valor numérico válido
        let variantPrice = price; // Usar o preço padrão como fallback
        if (variant.price) {
          const cleanVariantPrice = variant.price.replace(/[^\d.,]/g, '').replace(',', '.');
          const numericVariantPrice = parseFloat(cleanVariantPrice);
          if (!isNaN(numericVariantPrice)) {
            variantPrice = numericVariantPrice.toFixed(2);
          }
        }
        
        return {
          price: variantPrice,
          sku: variant.sku || '',
          inventoryQuantity: variant.inventory_quantity || 1,
          title: variant.title || 'Padrão'
        };
      });
    } else {
      // Se não temos variantes, criar uma variante padrão
      variants = [{
        price: price,
        inventoryQuantity: 1,
        title: 'Padrão'
      }];
    }

    // Preparar as imagens para a API
    const images = processedImages.map(img => ({
      src: `data:image/jpeg;base64,${img.attachment}`,
      alt: img.filename
    }));

    // Preparar os dados para a API REST do Shopify
    const productPayload = {
      product: {
        title: title,
        body_html: description,
        vendor: "Importado",
        product_type: "Produto Importado",
        status: "active",
        published: true,
        variants: variants,
        images: images
      }
    };
    
    console.log('=== INÍCIO DA REQUISIÇÃO PARA O SHOPIFY ===');
    
    try {
      // Fazer a requisição usando a API REST do Shopify
      const shopifyEndpoint = `https://${cleanDomain}/admin/api/2023-10/products.json`;
      
      console.log('Endpoint Shopify:', shopifyEndpoint);
      
      const response = await fetch(shopifyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify(productPayload)
      });
      
      // Log da resposta HTTP
      console.log('Status da resposta HTTP:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta da API do Shopify:', response.status, errorText);
        throw new Error(`Erro na API do Shopify: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Resposta da API do Shopify:', JSON.stringify(responseData, null, 2));
      
      // Verificar se a resposta contém os dados do produto
      if (responseData && responseData.product) {
        const createdProduct = responseData.product;
        
        return NextResponse.json({
          success: true,
          message: 'Produto criado com sucesso no Shopify',
          productId: createdProduct.id,
          productTitle: createdProduct.title,
          productUrl: `https://${cleanDomain}/admin/products/${createdProduct.id}`
        });
      } else {
        throw new Error('Resposta inválida da API do Shopify');
      }
      
    } catch (error) {
      console.error('Erro ao criar produto no Shopify:', error);
      
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Erro ao criar produto no Shopify',
          details: error instanceof Error ? error.stack : undefined
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Erro ao processar a requisição de importação:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar a requisição de importação' },
      { status: 500 }
    );
  }
}
