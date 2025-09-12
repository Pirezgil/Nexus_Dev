import { Request, Response } from 'express';
import { NoteService } from '../services/noteService';
import { 
  CreateNoteInput, 
  UpdateNoteInput,
  PaginationInput,
  ApiResponse 
} from '../types';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';

export class NoteController {
  private noteService: NoteService;

  constructor() {
    this.noteService = new NoteService();
  }

  /**
   * Helper function to safely get authentication data from request
   * Follows the same pattern as CustomerController for consistency
   */
  private getAuthData(req: Request) {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const userId = req.user?.userId || req.headers['x-user-id'] as string;
    
    if (!companyId || !userId) {
      throw new Error('Authentication required: companyId and userId not found');
    }
    
    return { companyId, userId };
  }

  /**
   * GET /customers/:customerId/notes
   * Get paginated notes for a customer
   */
  getNotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { companyId, userId } = this.getAuthData(req);
      const pagination = req.query as unknown as PaginationInput;

      const result = await this.noteService.getNotes(customerId, companyId, pagination, userId);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Notas recuperadas com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/notes/:noteId
   * Get note by ID
   */
  getNoteById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { noteId } = req.params;
      const { companyId, userId } = this.getAuthData(req);

      const note = await this.noteService.getNoteById(noteId, companyId, userId);

      const response: ApiResponse = {
        success: true,
        data: note,
        message: 'Nota encontrada com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * POST /customers/:customerId/notes
   * Create new note for customer
   */
  createNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const data = req.body as CreateNoteInput;
      const { companyId, userId: createdBy } = this.getAuthData(req);

      const note = await this.noteService.createNote(customerId, data, companyId, createdBy);

      const response: ApiResponse = {
        success: true,
        data: note,
        message: 'Nota criada com sucesso',
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * PUT /customers/:customerId/notes/:noteId
   * Update note
   */
  updateNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { noteId } = req.params;
      const data = req.body as UpdateNoteInput;
      const { companyId, userId } = this.getAuthData(req);

      const note = await this.noteService.updateNote(noteId, data, companyId, userId);

      const response: ApiResponse = {
        success: true,
        data: note,
        message: 'Nota atualizada com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * DELETE /customers/:customerId/notes/:noteId
   * Delete note
   */
  deleteNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { noteId } = req.params;
      const { companyId, userId } = this.getAuthData(req);

      await this.noteService.deleteNote(noteId, companyId, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Nota deletada com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/notes/type/:type
   * Get notes by type for a customer
   */
  getNotesByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, type } = req.params;
      const { limit = '20' } = req.query;
      const { companyId, userId } = this.getAuthData(req);

      const notes = await this.noteService.getNotesByType(
        customerId,
        type,
        companyId,
        userId,
        parseInt(limit as string, 10)
      );

      const response: ApiResponse = {
        success: true,
        data: notes,
        message: `Notas do tipo ${type} recuperadas com sucesso`,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/notes/recent
   * Get recent notes for a customer
   */
  getRecentNotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { limit = '5' } = req.query;
      const { companyId, userId } = this.getAuthData(req);

      const notes = await this.noteService.getRecentNotes(
        customerId,
        companyId,
        userId,
        parseInt(limit as string, 10)
      );

      const response: ApiResponse = {
        success: true,
        data: notes,
        message: 'Notas recentes recuperadas com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/notes/search
   * Search notes by content
   */
  searchNotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { q: searchTerm, limit = '10' } = req.query;
      const { companyId, userId } = this.getAuthData(req);

      if (!searchTerm || typeof searchTerm !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: 'ValidationError',
          message: 'Termo de busca é obrigatório',
        };
        res.status(400).json(response);
        return;
      }

      const notes = await this.noteService.searchNotes(
        customerId,
        searchTerm,
        companyId,
        userId,
        parseInt(limit as string, 10)
      );

      const response: ApiResponse = {
        success: true,
        data: notes,
        message: 'Busca de notas realizada com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/notes/stats
   * Get notes statistics for a customer
   */
  getNotesStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { companyId, userId } = this.getAuthData(req);

      const stats = await this.noteService.getNotesStats(customerId, companyId, userId);

      const response: ApiResponse = {
        success: true,
        data: stats,
        message: 'Estatísticas de notas recuperadas com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });
}