// ERP Nexus - Componente Avatar Centralizado
// Este é o ÚNICO lugar onde o avatar do usuário é implementado

'use client';

import React from 'react';
import { useCurrentUser } from '@/stores/auth';

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showImage?: boolean;
}

const SIZES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg', 
  lg: 'w-20 h-20 text-2xl'
};

/**
 * COMPONENTE AVATAR CENTRALIZADO
 * 
 * IMPORTANTE: Este é o ÚNICO lugar onde a lógica do avatar é implementada.
 * Todas as páginas devem usar este componente.
 * 
 * Features:
 * - Carrega imagem do usuário automaticamente
 * - Fallback para iniciais se imagem falhar
 * - Tamanhos padronizados
 * - Lógica centralizada de carregamento
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  size = 'md', 
  className = '',
  showImage = true 
}) => {
  const { user, displayName } = useCurrentUser();
  const [imageError, setImageError] = React.useState(false);

  // Reset imageError when user avatar changes
  React.useEffect(() => {
    setImageError(false);
  }, [user?.avatar]);

  // Gerar iniciais do usuário
  const getInitials = () => {
    if (!displayName) return 'UN';
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // URL da imagem do avatar
  const getAvatarUrl = () => {
    if (!user?.avatar) return null;
    // URL completa ou relativa
    if (user.avatar.startsWith('http')) {
      return user.avatar;
    }
    // Avatar é servido através do API Gateway - usar URL relativa para evitar CORS
    return `/api/auth${user.avatar}`;
  };

  const avatarUrl = getAvatarUrl();
  const shouldShowImage = showImage && avatarUrl && !imageError;

  // Debug temporário
  if (avatarUrl) {
    console.log('🔍 UserAvatar:', {
      avatarUrl,
      shouldShowImage,
      imageError,
      userAvatar: user?.avatar
    });
  }

  return (
    <div 
      className={`
        ${SIZES[size]} 
        rounded-full 
        overflow-hidden 
        flex 
        items-center 
        justify-center 
        bg-blue-600
        ${className}
      `}
    >
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt={displayName || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-white font-medium">
          {getInitials()}
        </span>
      )}
    </div>
  );
};