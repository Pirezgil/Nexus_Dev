import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuração para rodar na porta 5000 conforme arquitetura ERP Nexus
  output: 'standalone',
  env: {
    CUSTOM_KEY: 'ERP_NEXUS_FRONTEND',
  },
  // Configurações para integração com backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*', // API Gateway
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:5001/api/auth/uploads/:path*', // Proxy para imagens via API Gateway
      },
    ];
  },
};

export default nextConfig;
