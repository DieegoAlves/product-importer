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
    
    // Obter credenciais do Shopify da requisição ou das variáveis de ambiente como fallback
    const shopifyCredentials = productData.shopifyCredentials || {};
    const shopifyDomain = shopifyCredentials.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = shopifyCredentials.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyDomain || !accessToken) {
      console.error('Credenciais do Shopify não configuradas');
      return NextResponse.json(
        { error: 'Credenciais do Shopify não configuradas. Por favor, configure nas configurações.' },
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
    
    // Preparar as imagens para a API - usando URLs diretas em vez de baixar e converter para base64
    const images = limitedImages.map((url: string) => ({
      src: url
    }));
    
    console.log(`Total de ${images.length} imagens processadas com sucesso`);
    
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
