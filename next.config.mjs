/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['*'],
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
};

export default nextConfig;
