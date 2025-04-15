# Product Importer

A powerful web application that scrapes product data from various e-commerce platforms and imports them directly into your Shopify store.

## Features

- **Multi-Platform Scraping**: Extract product data from multiple e-commerce platforms including:
  - Mercado Livre
  - VTEX-based stores
  - Generic e-commerce sites
  
- **Comprehensive Data Extraction**: Automatically extracts:
  - Product titles
  - Pricing information
  - Detailed descriptions (with HTML formatting)
  - Product images
  
- **Shopify Integration**: Seamlessly imports products into your Shopify store with:
  - Properly formatted descriptions
  - All product images
  - Accurate pricing
  - Appropriate product categorization

- **Modern UI**: Clean, responsive interface built with:
  - Next.js 14
  - Shopify Polaris design system
  - TypeScript for type safety

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- A Shopify store with Admin API access
- Shopify API credentials (API key and access token)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/DieegoAlves/product-importer.git
cd product-importer
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Set up your environment variables:
   Create a `.env.local` file in the root directory with:

```
SHOPIFY_SHOP_DOMAIN=your-store-name.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

1. Enter the URL of the product you want to import in the input field
2. Select the type of store (Mercado Livre, VTEX, or Other)
3. Click "Import Product"
4. The application will scrape the product data and import it to your Shopify store
5. You'll see a success message with details about the imported product

## Architecture

The application uses a modular scraper architecture:

- `types.ts`: Defines interfaces for product data and scraper functionality
- `scraper-factory.ts`: Factory pattern to create the appropriate scraper based on store type
- Specialized scrapers:
  - `mercadolivre-scraper.ts`: Handles Mercado Livre product pages
  - `vtex-scraper.ts`: Handles VTEX-based store product pages
  - `generic-scraper.ts`: Fallback for other e-commerce platforms

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Powered by [Windsurf](https://windsurf.com/)
- Built with [Next.js](https://nextjs.org) and [Shopify Polaris](https://polaris.shopify.com/)
