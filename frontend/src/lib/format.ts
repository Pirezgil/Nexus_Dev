/**
 * Funções de formatação para uso em todo o aplicativo
 */

/**
 * Formata número de telefone brasileiro
 */
export const formatPhone = (phone?: string): string => {
  if (!phone) return '-';
  
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // Celular: (XX) XXXXX-XXXX
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    // Fixo: (XX) XXXX-XXXX
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
};

/**
 * Formata valor monetário em Reais
 */
export const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Formata data para o padrão brasileiro
 */
export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
};

/**
 * Formata data e hora completas
 */
export const formatDateTime = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleString('pt-BR');
  } catch {
    return dateString;
  }
};

/**
 * Retorna o tempo relativo (ex: "há 2 dias")
 */
export const getDaysSince = (dateString: string): number => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

/**
 * Formata tempo relativo de forma amigável
 */
export const formatTimeAgo = (dateString: string): string => {
  const days = getDaysSince(dateString);
  
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} semanas`;
  if (days < 365) return `há ${Math.floor(days / 30)} meses`;
  return `há ${Math.floor(days / 365)} anos`;
};

/**
 * Formata apenas a hora
 */
export const formatTime = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

/**
 * Formata CPF ou CNPJ
 */
export const formatDocument = (document?: string): string => {
  if (!document) return '-';
  
  const cleaned = document.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // CPF: XXX.XXX.XXX-XX
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (cleaned.length === 14) {
    // CNPJ: XX.XXX.XXX/XXXX-XX
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return document;
};

/**
 * Formata endereço completo
 */
export const formatAddress = (address: {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
}): string => {
  const parts = [
    address.street,
    address.number,
    address.complement
  ].filter(Boolean).join(', ');
  
  const location = [
    address.neighborhood,
    address.city,
    address.state
  ].filter(Boolean).join(', ');
  
  const fullAddress = [parts, location].filter(Boolean).join(' - ');
  
  if (address.zipcode) {
    return `${fullAddress} - ${address.zipcode}`;
  }
  
  return fullAddress;
};

/**
 * Formata endereço de forma compacta
 */
export const formatAddressCompact = (address: {
  street?: string;
  number?: string;
  city?: string;
  state?: string;
}): string => {
  const street = [address.street, address.number].filter(Boolean).join(', ');
  const location = [address.city, address.state].filter(Boolean).join('/');
  return [street, location].filter(Boolean).join(' - ');
};

/**
 * Trunca texto com ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

/**
 * Capitaliza primeira letra de cada palavra
 */
export const capitalizeWords = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Formata bytes para KB, MB, GB etc.
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};