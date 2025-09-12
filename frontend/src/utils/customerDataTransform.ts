/**
 * Transforma dados do formulário frontend para o formato esperado pelo backend
 * Isso garante compatibilidade entre o formulário estruturado e a API
 */

export interface FormAddressData {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

export interface CustomerFormData {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: FormAddressData;
  status?: 'ACTIVE' | 'PROSPECT' | 'INACTIVE' | 'BLOCKED';
  tags?: string[];
  profession?: string;
  source?: string;
  preferredContact?: string;
  marketingConsent?: boolean;
  secondaryPhone?: string;
  rg?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
}

export interface ApiCustomerData {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  addressStructured?: FormAddressData;
  status?: 'ACTIVE' | 'PROSPECT' | 'INACTIVE' | 'BLOCKED';
  tags?: string[];
  profession?: string;
  source?: string;
  preferredContact?: string;
  marketingConsent?: boolean;
  secondaryPhone?: string;
  rg?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
  metadata?: any;
}

/**
 * Transforma dados do formulário para o formato da API
 */
export function transformCustomerFormToApi(formData: CustomerFormData): ApiCustomerData {
  const apiData: ApiCustomerData = {
    name: formData.name,
    email: formData.email || undefined,
    phone: formData.phone || undefined,
    document: formData.document || undefined,
    status: formData.status || 'ACTIVE',
    tags: formData.tags || [],
    profession: formData.profession,
    source: formData.source,
    preferredContact: formData.preferredContact,
    marketingConsent: formData.marketingConsent,
    secondaryPhone: formData.secondaryPhone,
    rg: formData.rg,
    birthDate: formData.birthDate,
    gender: formData.gender,
    maritalStatus: formData.maritalStatus,
  };

  // Transformar endereço estruturado
  if (formData.address) {
    // Only include address if at least one field is filled
    const hasAddressData = Object.values(formData.address).some(value => value && value.trim() !== '');
    
    if (hasAddressData) {
      apiData.addressStructured = {
        street: formData.address.street?.trim(),
        number: formData.address.number?.trim(),
        complement: formData.address.complement?.trim(),
        neighborhood: formData.address.neighborhood?.trim(),
        city: formData.address.city?.trim(),
        state: formData.address.state?.trim(),
        zipcode: formData.address.zipcode?.trim(),
        country: formData.address.country?.trim(),
      };
    }
  }

  // Criar metadata com informações adicionais
  const metadata: any = {};
  if (formData.profession) metadata.profession = formData.profession;
  if (formData.source) metadata.source = formData.source;
  if (formData.preferredContact) metadata.preferredContact = formData.preferredContact;
  if (formData.marketingConsent !== undefined) metadata.marketingConsent = formData.marketingConsent;
  
  // Only add metadata if there's actual data
  if (Object.keys(metadata).length > 0) {
    apiData.metadata = metadata;
  }

  // Remover campos undefined
  Object.keys(apiData).forEach(key => {
    if (apiData[key as keyof ApiCustomerData] === undefined) {
      delete apiData[key as keyof ApiCustomerData];
    }
  });

  return apiData;
}

/**
 * Valida se o endereço tem dados suficientes para ser salvo
 */
export function hasValidAddress(address?: FormAddressData): boolean {
  if (!address) return false;
  
  return Object.values(address).some(value => 
    value && typeof value === 'string' && value.trim().length > 0
  );
}

/**
 * Formata endereço para exibição
 */
export function formatAddressForDisplay(address?: FormAddressData): string {
  if (!address || !hasValidAddress(address)) return '';
  
  const parts = [
    address.street,
    address.number,
    address.complement && `(${address.complement})`,
    address.neighborhood,
  ].filter(Boolean);

  const addressLine = parts.join(', ');
  
  const locationParts = [
    address.city,
    address.state,
    address.zipcode,
  ].filter(Boolean);

  const locationLine = locationParts.join(' - ');
  
  return [addressLine, locationLine].filter(Boolean).join('\n');
}