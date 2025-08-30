import { 
  CustomerNoteDetails, 
  CreateNoteData, 
  UpdateNoteData,
  PaginatedResponse,
  PaginationQuery,
  NotFoundError,
  ForbiddenError
} from '../types';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

export class NoteService {
  /**
   * Get paginated notes for a customer
   */
  async getNotes(
    customerId: string,
    companyId: string,
    pagination: PaginationQuery,
    userId: string
  ): Promise<PaginatedResponse<CustomerNoteDetails>> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Build where clause - exclude private notes from other users
      const where = {
        customerId,
        companyId,
        OR: [
          { isPrivate: false },
          { AND: [{ isPrivate: true }, { createdBy: userId }] }
        ],
      };

      // Execute queries in parallel
      const [notes, total] = await Promise.all([
        prisma.customerNote.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.customerNote.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: notes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error getting notes', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Get note by ID
   */
  async getNoteById(noteId: string, companyId: string, userId: string): Promise<CustomerNoteDetails> {
    try {
      const note = await prisma.customerNote.findFirst({
        where: { id: noteId, companyId },
      });

      if (!note) {
        throw new NotFoundError('Nota não encontrada');
      }

      // Check if user can access this note (if it's private and not created by the user)
      if (note.isPrivate && note.createdBy !== userId) {
        throw new ForbiddenError('Você não tem permissão para acessar esta nota privada');
      }

      return note;
    } catch (error) {
      logger.error('Error getting note by ID', { error, noteId, companyId });
      throw error;
    }
  }

  /**
   * Create new note
   */
  async createNote(
    customerId: string,
    data: CreateNoteData,
    companyId: string,
    createdBy: string
  ): Promise<CustomerNoteDetails> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const note = await prisma.customerNote.create({
        data: {
          customerId,
          companyId,
          content: data.content,
          type: data.type || 'GENERAL',
          isPrivate: data.isPrivate || false,
          createdBy,
        },
      });

      logger.info('Note created', { noteId: note.id, customerId, companyId, createdBy });

      // Invalidate customer cache
      await this.invalidateCustomerCaches(customerId, companyId);

      return note;
    } catch (error) {
      logger.error('Error creating note', { error, customerId, data, companyId });
      throw error;
    }
  }

  /**
   * Update note
   */
  async updateNote(
    noteId: string,
    data: UpdateNoteData,
    companyId: string,
    userId: string
  ): Promise<CustomerNoteDetails> {
    try {
      // Get existing note
      const existingNote = await prisma.customerNote.findFirst({
        where: { id: noteId, companyId },
      });

      if (!existingNote) {
        throw new NotFoundError('Nota não encontrada');
      }

      // Check if user can edit this note (only creator can edit)
      if (existingNote.createdBy !== userId) {
        throw new ForbiddenError('Você só pode editar suas próprias notas');
      }

      const note = await prisma.customerNote.update({
        where: { id: noteId },
        data,
      });

      logger.info('Note updated', { noteId, companyId, userId, changes: data });

      // Invalidate customer cache
      await this.invalidateCustomerCaches(existingNote.customerId, companyId);

      return note;
    } catch (error) {
      logger.error('Error updating note', { error, noteId, data, companyId });
      throw error;
    }
  }

  /**
   * Delete note
   */
  async deleteNote(noteId: string, companyId: string, userId: string): Promise<void> {
    try {
      // Get existing note
      const existingNote = await prisma.customerNote.findFirst({
        where: { id: noteId, companyId },
      });

      if (!existingNote) {
        throw new NotFoundError('Nota não encontrada');
      }

      // Check if user can delete this note (only creator can delete)
      if (existingNote.createdBy !== userId) {
        throw new ForbiddenError('Você só pode deletar suas próprias notas');
      }

      await prisma.customerNote.delete({
        where: { id: noteId },
      });

      logger.info('Note deleted', { noteId, companyId, userId });

      // Invalidate customer cache
      await this.invalidateCustomerCaches(existingNote.customerId, companyId);
    } catch (error) {
      logger.error('Error deleting note', { error, noteId, companyId });
      throw error;
    }
  }

  /**
   * Get notes by type for a customer
   */
  async getNotesByType(
    customerId: string,
    type: string,
    companyId: string,
    userId: string,
    limit: number = 20
  ): Promise<CustomerNoteDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const notes = await prisma.customerNote.findMany({
        where: {
          customerId,
          companyId,
          type: type as any,
          OR: [
            { isPrivate: false },
            { AND: [{ isPrivate: true }, { createdBy: userId }] }
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notes;
    } catch (error) {
      logger.error('Error getting notes by type', { error, customerId, type, companyId });
      throw error;
    }
  }

  /**
   * Get recent notes for a customer
   */
  async getRecentNotes(
    customerId: string,
    companyId: string,
    userId: string,
    limit: number = 5
  ): Promise<CustomerNoteDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const notes = await prisma.customerNote.findMany({
        where: {
          customerId,
          companyId,
          OR: [
            { isPrivate: false },
            { AND: [{ isPrivate: true }, { createdBy: userId }] }
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notes;
    } catch (error) {
      logger.error('Error getting recent notes', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Search notes by content
   */
  async searchNotes(
    customerId: string,
    searchTerm: string,
    companyId: string,
    userId: string,
    limit: number = 10
  ): Promise<CustomerNoteDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const notes = await prisma.customerNote.findMany({
        where: {
          customerId,
          companyId,
          content: { contains: searchTerm, mode: 'insensitive' },
          OR: [
            { isPrivate: false },
            { AND: [{ isPrivate: true }, { createdBy: userId }] }
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return notes;
    } catch (error) {
      logger.error('Error searching notes', { error, customerId, searchTerm, companyId });
      throw error;
    }
  }

  /**
   * Get notes statistics for a customer
   */
  async getNotesStats(customerId: string, companyId: string, userId: string): Promise<any> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const stats = await prisma.customerNote.groupBy({
        by: ['type'],
        where: {
          customerId,
          companyId,
          OR: [
            { isPrivate: false },
            { AND: [{ isPrivate: true }, { createdBy: userId }] }
          ],
        },
        _count: {
          id: true,
        },
      });

      const totalNotes = await prisma.customerNote.count({
        where: {
          customerId,
          companyId,
          OR: [
            { isPrivate: false },
            { AND: [{ isPrivate: true }, { createdBy: userId }] }
          ],
        },
      });

      return {
        total: totalNotes,
        byType: stats.map(stat => ({
          type: stat.type,
          count: stat._count.id,
        })),
      };
    } catch (error) {
      logger.error('Error getting notes stats', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Private method to invalidate customer-related caches
   */
  private async invalidateCustomerCaches(customerId: string, companyId: string): Promise<void> {
    try {
      await Promise.all([
        redis.del(`crm:customer:${customerId}`),
        redis.del(`crm:stats:${companyId}`),
      ]);
    } catch (error) {
      logger.warn('Error invalidating customer caches', { error, customerId, companyId });
    }
  }
}