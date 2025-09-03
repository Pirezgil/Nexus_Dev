/**
 * Utilitários para formatação e manipulação de endereços
 * Alinhado com a estrutura de dados esperada pelo backend
 */

import { Address } from '@/types';

/**
 * Formatar endereço estruturado em string legível para o usuário
 * Segue o padrão brasileiro: "Rua das Flores, 123 - Centro, São Paulo - SP, 01234-567"
 */
export function formatAddress(address: Address | null): string {
  if (!address) return '-';

  const parts: string[] = [];

  // Rua e número
  if (address.street && address.number) {
    parts.push(`${address.street}, ${address.number}`);
  } else if (address.street) {
    parts.push(address.street);
  }

  // Complemento (entre parênteses se existir)
  if (address.complement) {
    const lastPart = parts.pop();
    if (lastPart) {
      parts.push(`${lastPart} (${address.complement})`);
    }
  }

  // Bairro
  if (address.neighborhood) {
    const streetPart = parts.join('');
    if (streetPart) {
      parts.push(` - ${address.neighborhood}`);
    } else {
      parts.push(address.neighborhood);
    }
  }

  // Cidade e Estado
  const location: string[] = [];
  if (address.city) location.push(address.city);
  if (address.state) location.push(address.state);

  if (location.length > 0) {
    parts.push(`, ${location.join(' - ')}`);
  }

  // CEP
  if (address.zipcode) {
    parts.push(`, ${address.zipcode}`);
  }

  return parts.join('').trim();
}

/**
 * Formatar endereço de forma mais compacta (para listas)
 * Ex: "Centro, São Paulo - SP"
 */
export function formatAddressCompact(address: Address | null): string {
  if (!address) return '-';

  const parts: string[] = [];

  if (address.neighborhood) parts.push(address.neighborhood);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(`- ${address.state}`);

  return parts.join(', ').trim();
}

/**
 * Verificar se um endereço está completo (todos os campos obrigatórios preenchidos)
 */
export function isAddressComplete(address: Address | null): boolean {
  if (!address) return false;

  return !!(
    address.street &&
    address.number &&
    address.neighborhood &&
    address.city &&
    address.state &&
    address.zipcode
  );
}

/**
 * Criar um objeto Address vazio/padrão
 */
export function createEmptyAddress(): Address {
  return {
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipcode: '',
  };
}

/**
 * Validar campos do endereço
 */
export function validateAddress(address: Address): { field: keyof Address; error: string }[] {
  const errors: { field: keyof Address; error: string }[] = [];

  if (!address.street?.trim()) {
    errors.push({ field: 'street', error: 'Rua é obrigatória' });
  }

  if (!address.number?.trim()) {
    errors.push({ field: 'number', error: 'Número é obrigatório' });
  }

  if (!address.neighborhood?.trim()) {
    errors.push({ field: 'neighborhood', error: 'Bairro é obrigatório' });
  }

  if (!address.city?.trim()) {
    errors.push({ field: 'city', error: 'Cidade é obrigatória' });
  }

  if (!address.state?.trim()) {
    errors.push({ field: 'state', error: 'Estado é obrigatório' });
  } else if (address.state.length !== 2) {
    errors.push({ field: 'state', error: 'Estado deve ter 2 caracteres (ex: SP)' });
  }

  if (!address.zipcode?.trim()) {
    errors.push({ field: 'zipcode', error: 'CEP é obrigatório' });
  } else if (!/^\d{5}-?\d{3}$/.test(address.zipcode)) {
    errors.push({ field: 'zipcode', error: 'CEP deve ter o formato 00000-000' });
  }

  return errors;
}

/**
 * Normalizar CEP para formato padrão (00000-000)
 */
export function normalizeCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  return cep;
}

/**
 * Converter endereço para payload de API (compatível com backend)
 */
export function addressToAPIPayload(address: Address | null) {
  if (!address) {
    return {
      address_street: null,
      address_number: null,
      address_complement: null,
      address_neighborhood: null,
      address_city: null,
      address_state: null,
      address_zipcode: null,
    };
  }

  return {
    address_street: address.street || null,
    address_number: address.number || null,
    address_complement: address.complement || null,
    address_neighborhood: address.neighborhood || null,
    address_city: address.city || null,
    address_state: address.state || null,
    address_zipcode: address.zipcode || null,
  };
}

/**
 * Converter resposta da API para endereço estruturado
 */
export function addressFromAPIResponse(apiData: any): Address | null {
  if (!apiData) return null;

  // Se já está no formato correto
  if (apiData.street) {
    return {
      street: apiData.street || '',
      number: apiData.number || '',
      complement: apiData.complement || '',
      neighborhood: apiData.neighborhood || '',
      city: apiData.city || '',
      state: apiData.state || '',
      zipcode: apiData.zipcode || '',
    };
  }

  // Se está no formato do backend (prefixado com address_)
  if (apiData.address_street || apiData.address_city) {
    return {
      street: apiData.address_street || '',
      number: apiData.address_number || '',
      complement: apiData.address_complement || '',
      neighborhood: apiData.address_neighborhood || '',
      city: apiData.address_city || '',
      state: apiData.address_state || '',
      zipcode: apiData.address_zipcode || '',
    };
  }

  return null;
}