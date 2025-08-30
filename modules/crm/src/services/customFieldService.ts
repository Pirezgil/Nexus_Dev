import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

/**
 * CustomFieldService
 * 
 * Gerencia campos customizados por empresa conforme especificação
 * docs/02-modules/crm.md (linhas 115-127)
 * 
 * Funcionalidades:
 * - CRUD de campos customizados
 * - Validação de tipos
 * - Cache para performance
 * - Reordenação de campos
 */

export interface CreateCustomFieldData {
  companyId: string;
  name: string;
  fieldType: string; // text, number, date, select, boolean
  options?: any; // Para tipo select
  required: boolean;
  displayOrder: number;
}

export interface UpdateCustomFieldData {
  name?: string;
  fieldType?: string;
  options?: any;
  required?: boolean;
  active?: boolean;
  displayOrder?: number;
}

export class CustomFieldService {
  
  /**
   * Get all custom fields for a company
   */
  async getCustomFields(companyId: string, activeOnly: boolean = true): Promise<any[]> {
    try {
      const cacheKey = `crm:custom_fields:${companyId}:${activeOnly}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const where: any = { companyId };
      if (activeOnly) {
        where.active = true;
      }

      const customFields = await prisma.customField.findMany({
        where,
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      // Transform to API format
      const formattedFields = customFields.map(field => ({
        id: field.id,
        name: field.name,
        field_type: field.fieldType,
        options: field.options,
        required: field.required,
        active: field.active,
        display_order: field.displayOrder,
        created_at: field.createdAt
      }));

      // Cache for 30 minutes
      await redis.setex(cacheKey, 1800, JSON.stringify(formattedFields));

      return formattedFields;
    } catch (error) {
      logger.error('Error getting custom fields', { error, companyId, activeOnly });
      throw error;
    }
  }

  /**
   * Get custom field by ID
   */
  async getCustomFieldById(fieldId: string, companyId: string): Promise<any | null> {
    try {
      const customField = await prisma.customField.findFirst({
        where: {
          id: fieldId,
          companyId
        }
      });

      if (!customField) {
        return null;
      }

      return {
        id: customField.id,
        name: customField.name,
        field_type: customField.fieldType,
        options: customField.options,
        required: customField.required,
        active: customField.active,
        display_order: customField.displayOrder,
        created_at: customField.createdAt
      };
    } catch (error) {
      logger.error('Error getting custom field by ID', { error, fieldId, companyId });
      throw error;
    }
  }

  /**
   * Create new custom field
   */
  async createCustomField(data: CreateCustomFieldData): Promise<any> {
    try {
      // Check if field name already exists for this company
      const existing = await prisma.customField.findFirst({
        where: {
          companyId: data.companyId,
          name: data.name,
          active: true
        }
      });

      if (existing) {
        throw new Error(`Campo customizado com nome '${data.name}' já existe`);
      }

      const customField = await prisma.customField.create({
        data: {
          companyId: data.companyId,
          name: data.name,
          fieldType: data.fieldType,
          options: data.options,
          required: data.required,
          displayOrder: data.displayOrder
        }
      });

      logger.info('Custom field created', { 
        fieldId: customField.id, 
        companyId: data.companyId, 
        name: data.name,
        type: data.fieldType 
      });

      // Invalidate cache
      await this.invalidateCustomFieldsCache(data.companyId);

      return {
        id: customField.id,
        name: customField.name,
        field_type: customField.fieldType,
        options: customField.options,
        required: customField.required,
        active: customField.active,
        display_order: customField.displayOrder,
        created_at: customField.createdAt
      };
    } catch (error) {
      logger.error('Error creating custom field', { error, data });
      throw error;
    }
  }

  /**
   * Update custom field
   */
  async updateCustomField(
    fieldId: string, 
    companyId: string, 
    data: UpdateCustomFieldData
  ): Promise<any | null> {
    try {
      // Check if field exists and belongs to company
      const existingField = await prisma.customField.findFirst({
        where: {
          id: fieldId,
          companyId
        }
      });

      if (!existingField) {
        return null;
      }

      // Check for name conflicts if name is being updated
      if (data.name && data.name !== existingField.name) {
        const nameConflict = await prisma.customField.findFirst({
          where: {
            companyId,
            name: data.name,
            active: true,
            id: { not: fieldId }
          }
        });

        if (nameConflict) {
          throw new Error(`Campo customizado com nome '${data.name}' já existe`);
        }
      }

      // Build update data
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.fieldType !== undefined) updateData.fieldType = data.fieldType;
      if (data.options !== undefined) updateData.options = data.options;
      if (data.required !== undefined) updateData.required = data.required;
      if (data.active !== undefined) updateData.active = data.active;
      if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

      const customField = await prisma.customField.update({
        where: { id: fieldId },
        data: updateData
      });

      logger.info('Custom field updated', { 
        fieldId, 
        companyId, 
        changes: updateData 
      });

      // Invalidate cache
      await this.invalidateCustomFieldsCache(companyId);

      return {
        id: customField.id,
        name: customField.name,
        field_type: customField.fieldType,
        options: customField.options,
        required: customField.required,
        active: customField.active,
        display_order: customField.displayOrder,
        created_at: customField.createdAt
      };
    } catch (error) {
      logger.error('Error updating custom field', { error, fieldId, companyId, data });
      throw error;
    }
  }

  /**
   * Delete custom field (soft delete - mark as inactive)
   */
  async deleteCustomField(fieldId: string, companyId: string): Promise<boolean> {
    try {
      const result = await prisma.customField.updateMany({
        where: {
          id: fieldId,
          companyId
        },
        data: {
          active: false
        }
      });

      if (result.count === 0) {
        return false;
      }

      logger.info('Custom field deleted (marked inactive)', { fieldId, companyId });

      // Invalidate cache
      await this.invalidateCustomFieldsCache(companyId);

      return true;
    } catch (error) {
      logger.error('Error deleting custom field', { error, fieldId, companyId });
      throw error;
    }
  }

  /**
   * Reorder custom fields (update display_order)
   */
  async reorderCustomFields(
    companyId: string, 
    fieldOrders: Array<{id: string, display_order: number}>
  ): Promise<void> {
    try {
      // Update each field's display_order in a transaction
      await prisma.$transaction(
        fieldOrders.map(({ id, display_order }) =>
          prisma.customField.updateMany({
            where: {
              id,
              companyId // Ensure field belongs to company
            },
            data: {
              displayOrder: display_order
            }
          })
        )
      );

      logger.info('Custom fields reordered', { companyId, fieldCount: fieldOrders.length });

      // Invalidate cache
      await this.invalidateCustomFieldsCache(companyId);
    } catch (error) {
      logger.error('Error reordering custom fields', { error, companyId, fieldOrders });
      throw error;
    }
  }

  /**
   * Get custom field values for a customer
   */
  async getCustomerFieldValues(customerId: string, companyId: string): Promise<any[]> {
    try {
      const fieldValues = await prisma.customerCustomValue.findMany({
        where: {
          customerId,
          customField: {
            companyId,
            active: true
          }
        },
        include: {
          customField: true
        },
        orderBy: {
          customField: {
            displayOrder: 'asc'
          }
        }
      });

      return fieldValues.map(fv => ({
        field_id: fv.customFieldId,
        field_name: fv.customField.name,
        field_type: fv.customField.fieldType,
        field_options: fv.customField.options,
        value: fv.value,
        created_at: fv.createdAt,
        updated_at: fv.updatedAt
      }));
    } catch (error) {
      logger.error('Error getting customer field values', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Set custom field value for a customer
   */
  async setCustomerFieldValue(
    customerId: string,
    customFieldId: string,
    value: string,
    companyId: string
  ): Promise<any> {
    try {
      // Verify field belongs to company
      const customField = await prisma.customField.findFirst({
        where: {
          id: customFieldId,
          companyId,
          active: true
        }
      });

      if (!customField) {
        throw new Error('Campo customizado não encontrado');
      }

      // Validate value based on field type
      const validatedValue = this.validateFieldValue(customField.fieldType, value, customField.options);

      // Upsert the value
      const fieldValue = await prisma.customerCustomValue.upsert({
        where: {
          customerId_customFieldId: {
            customerId,
            customFieldId
          }
        },
        update: {
          value: validatedValue
        },
        create: {
          customerId,
          customFieldId,
          value: validatedValue
        }
      });

      return {
        field_id: fieldValue.customFieldId,
        value: fieldValue.value,
        updated_at: fieldValue.updatedAt
      };
    } catch (error) {
      logger.error('Error setting customer field value', { error, customerId, customFieldId, value });
      throw error;
    }
  }

  /**
   * Validate field value based on field type
   */
  private validateFieldValue(fieldType: string, value: string, options?: any): string {
    if (!value || value.trim() === '') {
      return '';
    }

    switch (fieldType) {
      case 'text':
        return value.trim();
      
      case 'number':
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('Valor deve ser um número válido');
        }
        return num.toString();
      
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Valor deve ser uma data válida');
        }
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      case 'boolean':
        const boolValue = value.toLowerCase();
        if (!['true', 'false', '1', '0', 'sim', 'não'].includes(boolValue)) {
          throw new Error('Valor deve ser verdadeiro ou falso');
        }
        return ['true', '1', 'sim'].includes(boolValue) ? 'true' : 'false';
      
      case 'select':
        if (!options || !Array.isArray(options)) {
          throw new Error('Campo select não possui opções configuradas');
        }
        if (!options.includes(value)) {
          throw new Error(`Valor deve ser uma das opções: ${options.join(', ')}`);
        }
        return value;
      
      default:
        return value.trim();
    }
  }

  /**
   * Get field statistics for a company
   */
  async getCustomFieldStats(companyId: string): Promise<any> {
    try {
      const stats = await prisma.customField.groupBy({
        by: ['fieldType'],
        where: {
          companyId,
          active: true
        },
        _count: {
          id: true
        }
      });

      const totalFields = await prisma.customField.count({
        where: {
          companyId,
          active: true
        }
      });

      const fieldsWithValues = await prisma.customerCustomValue.groupBy({
        by: ['customFieldId'],
        where: {
          customField: {
            companyId,
            active: true
          }
        },
        _count: {
          customerId: true
        }
      });

      return {
        total_fields: totalFields,
        fields_by_type: stats.reduce((acc: any, stat) => {
          acc[stat.fieldType] = stat._count.id;
          return acc;
        }, {}),
        fields_with_data: fieldsWithValues.length,
        usage_stats: fieldsWithValues.map(fwv => ({
          field_id: fwv.customFieldId,
          customers_with_value: fwv._count.customerId
        }))
      };
    } catch (error) {
      logger.error('Error getting custom field stats', { error, companyId });
      throw error;
    }
  }

  /**
   * Private method to invalidate custom fields cache
   */
  private async invalidateCustomFieldsCache(companyId: string): Promise<void> {
    try {
      await Promise.all([
        redis.del(`crm:custom_fields:${companyId}:true`),
        redis.del(`crm:custom_fields:${companyId}:false`),
        redis.del(`crm:customer_custom_fields:${companyId}:*`) // Pattern delete would need implementation
      ]);
    } catch (error) {
      logger.warn('Error invalidating custom fields cache', { error, companyId });
    }
  }
}