import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuração para rodar na porta 5000 conforme arquitetura ERP Nexus
  output: 'standalone',
  env: {
    CUSTOM_KEY: 'ERP_NEXUS_FRONTEND',
  },
  // Desabilitar ESLint durante o build para Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Desabilitar TypeScript check durante o build para Docker
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configurações para integração com backend - Todas via Gateway
  // Desenvolvimento: usa rewrites para API Gateway
  // Produção: usa URLs relativas (Nginx faz o proxy)
  async rewrites() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:5001';
    
    console.log('🔧 Next.js Rewrites Config:', {
      gatewayUrl,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT || '3000 (default)',
      isProduction,
      isDevelopment
    });
    
    // Em produção, o Nginx faz o proxy - não precisamos de rewrites
    if (isProduction) {
      console.log('🚀 Produção: Rewrites desabilitados (Nginx faz o proxy)');
      return [];
    }
    
    // Em desenvolvimento local (npm run dev), fazemos proxy para localhost
    // Em desenvolvimento Docker, as variáveis de ambiente fazem a comunicação direta
    if (isDevelopment && !process.env.NEXT_PUBLIC_API_BASE_URL) {
      console.log('🔧 Desenvolvimento local: Habilitando rewrites para localhost');
      return [
        {
          source: '/api/:path*',
          destination: `${gatewayUrl}/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${gatewayUrl}/uploads/:path*`,
        },
      ];
    }
    
    // Para Docker ou quando API_BASE_URL está definida, não usar rewrites
    console.log('🐳 Docker ou API_BASE_URL definida: Rewrites desabilitados');
    return [];
  },
};

export default nextConfig;
