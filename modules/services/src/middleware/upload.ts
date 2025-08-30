import multer, { FileFilterCallback, MulterError } from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ValidationError, ServiceError } from '../types';

// File upload configuration
const uploadConfig = {
  dest: config.uploadPath,
  maxFileSize: config.maxFileSize,
  allowedMimeTypes: config.allowedMimeTypes,
  imageFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
  maxFiles: 10,
  maxDimensions: {
    width: 4096,
    height: 4096,
  },
  thumbnailSizes: [
    { name: 'thumb', width: 150, height: 150 },
    { name: 'medium', width: 500, height: 500 },
    { name: 'large', width: 1200, height: 1200 },
  ],
};

// Create storage configuration
const storage = multer.diskStorage({
  destination: async (req: Request, file: Express.Multer.File, cb) => {
    try {
      // Create subdirectories based on company and date
      const companyId = req.companyId || 'default';
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const uploadPath = path.join(
        config.uploadPath,
        companyId,
        'services',
        year.toString(),
        month,
        day
      );
      
      // Ensure directory exists
      await fs.ensureDir(uploadPath);
      
      cb(null, uploadPath);
    } catch (error) {
      logger.error('Error creating upload directory', { error });
      cb(error as Error, '');
    }
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    try {
      // Generate unique filename
      const uniqueName = `${uuidv4()}-${Date.now()}`;
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${uniqueName}${extension}`;
      
      cb(null, filename);
    } catch (error) {
      cb(error as Error, '');
    }
  },
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  try {
    // Check MIME type
    if (!uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      const error = new ValidationError(
        `Invalid file type: ${file.mimetype}. Allowed types: ${uploadConfig.allowedMimeTypes.join(', ')}`
      );
      return cb(error);
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase().substring(1);
    if (!uploadConfig.imageFormats.includes(extension)) {
      const error = new ValidationError(
        `Invalid file extension: ${extension}. Allowed extensions: ${uploadConfig.imageFormats.join(', ')}`
      );
      return cb(error);
    }

    // Additional security checks
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      const error = new ValidationError('Invalid filename: contains illegal characters');
      return cb(error);
    }

    cb(null, true);
  } catch (error) {
    cb(error as Error);
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: uploadConfig.maxFileSize,
    files: uploadConfig.maxFiles,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024, // 1MB for field values
  },
});

/**
 * Single file upload middleware
 */
export const uploadSingle = (fieldName: string = 'file') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, async (error) => {
      if (error) {
        return handleUploadError(error, req, res, next);
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'NO_FILE',
        });
      }

      try {
        // Process the uploaded image
        const processedFile = await processImage(req.file, req.companyId);
        req.file = { ...req.file, ...processedFile };

        logger.info('File uploaded successfully', {
          originalName: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          companyId: req.companyId,
          userId: req.user?.id,
        });

        next();
      } catch (processingError) {
        // Clean up uploaded file on processing error
        await cleanupFile(req.file.path);
        return handleUploadError(processingError as Error, req, res, next);
      }
    });
  };
};

/**
 * Multiple files upload middleware
 */
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 10) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    upload.array(fieldName, maxCount)(req, res, async (error) => {
      if (error) {
        return handleUploadError(error, req, res, next);
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
          code: 'NO_FILES',
        });
      }

      try {
        // Process all uploaded images
        const processedFiles = await Promise.all(
          req.files.map(file => processImage(file, req.companyId))
        );

        // Update files with processed information
        req.files = req.files.map((file, index) => ({
          ...file,
          ...processedFiles[index],
        }));

        logger.info('Multiple files uploaded successfully', {
          count: req.files.length,
          totalSize: req.files.reduce((sum, file) => sum + file.size, 0),
          companyId: req.companyId,
          userId: req.user?.id,
        });

        next();
      } catch (processingError) {
        // Clean up uploaded files on processing error
        if (req.files && Array.isArray(req.files)) {
          await Promise.all(req.files.map(file => cleanupFile(file.path)));
        }
        return handleUploadError(processingError as Error, req, res, next);
      }
    });
  };
};

/**
 * Process uploaded image - validate, optimize, and create thumbnails
 */
const processImage = async (
  file: Express.Multer.File,
  companyId?: string
): Promise<{
  width?: number;
  height?: number;
  thumbnails?: Array<{ name: string; path: string; width: number; height: number; size: number }>;
}> => {
  try {
    // Get image metadata
    const metadata = await sharp(file.path).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new ValidationError('Unable to read image dimensions');
    }

    // Validate image dimensions
    if (
      metadata.width > uploadConfig.maxDimensions.width ||
      metadata.height > uploadConfig.maxDimensions.height
    ) {
      throw new ValidationError(
        `Image too large: ${metadata.width}x${metadata.height}. Max allowed: ${uploadConfig.maxDimensions.width}x${uploadConfig.maxDimensions.height}`
      );
    }

    // Create thumbnails
    const thumbnails = await createThumbnails(file, metadata);

    // Optimize original image if it's too large
    if (file.size > 2 * 1024 * 1024) { // 2MB threshold
      await optimizeImage(file.path);
      
      // Update file size after optimization
      const stats = await fs.stat(file.path);
      file.size = stats.size;
    }

    logger.debug('Image processed successfully', {
      filename: file.filename,
      originalSize: file.size,
      dimensions: `${metadata.width}x${metadata.height}`,
      thumbnails: thumbnails.length,
      companyId,
    });

    return {
      width: metadata.width,
      height: metadata.height,
      thumbnails,
    };
  } catch (error) {
    logger.error('Image processing failed', {
      filename: file.filename,
      error,
      companyId,
    });
    throw error;
  }
};

/**
 * Create thumbnails for uploaded image
 */
const createThumbnails = async (
  file: Express.Multer.File,
  metadata: sharp.Metadata
): Promise<Array<{ name: string; path: string; width: number; height: number; size: number }>> => {
  const thumbnails = [];
  const fileDir = path.dirname(file.path);
  const fileName = path.parse(file.filename).name;

  for (const size of uploadConfig.thumbnailSizes) {
    try {
      // Only create thumbnail if original is larger
      if (metadata.width! > size.width || metadata.height! > size.height) {
        const thumbnailPath = path.join(fileDir, `${fileName}_${size.name}.webp`);
        
        await sharp(file.path)
          .resize(size.width, size.height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toFile(thumbnailPath);

        const stats = await fs.stat(thumbnailPath);
        const thumbMetadata = await sharp(thumbnailPath).metadata();

        thumbnails.push({
          name: size.name,
          path: thumbnailPath,
          width: thumbMetadata.width!,
          height: thumbMetadata.height!,
          size: stats.size,
        });
      }
    } catch (error) {
      logger.warn('Failed to create thumbnail', {
        size: size.name,
        filename: file.filename,
        error,
      });
    }
  }

  return thumbnails;
};

/**
 * Optimize image by reducing quality and size
 */
const optimizeImage = async (imagePath: string): Promise<void> => {
  try {
    const tempPath = `${imagePath}.tmp`;
    
    await sharp(imagePath)
      .jpeg({ quality: 85, progressive: true })
      .png({ quality: 85, compressionLevel: 9 })
      .webp({ quality: 85 })
      .toFile(tempPath);

    // Replace original with optimized version
    await fs.move(tempPath, imagePath, { overwrite: true });
  } catch (error) {
    logger.warn('Image optimization failed', { imagePath, error });
    // Don't throw - optimization failure shouldn't block upload
  }
};

/**
 * Handle upload errors
 */
const handleUploadError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('File upload error', {
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    companyId: req.companyId,
  });

  if (error instanceof MulterError) {
    let message = 'File upload error';
    let code = 'UPLOAD_ERROR';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size: ${uploadConfig.maxFileSize / 1024 / 1024}MB`;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = `Too many files. Maximum: ${uploadConfig.maxFiles}`;
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FIELD';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many form parts';
        code = 'TOO_MANY_PARTS';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        code = 'FIELD_NAME_TOO_LONG';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        code = 'FIELD_VALUE_TOO_LONG';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        code = 'TOO_MANY_FIELDS';
        break;
    }

    return res.status(400).json({
      success: false,
      error: message,
      code,
    });
  }

  if (error instanceof ServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error during file upload',
    code: 'UPLOAD_INTERNAL_ERROR',
  });
};

/**
 * Clean up uploaded file
 */
const cleanupFile = async (filePath: string): Promise<void> => {
  try {
    await fs.remove(filePath);
    
    // Also remove thumbnails
    const fileDir = path.dirname(filePath);
    const fileName = path.parse(path.basename(filePath)).name;
    
    for (const size of uploadConfig.thumbnailSizes) {
      const thumbnailPath = path.join(fileDir, `${fileName}_${size.name}.webp`);
      try {
        await fs.remove(thumbnailPath);
      } catch {
        // Ignore errors for thumbnails that might not exist
      }
    }
  } catch (error) {
    logger.warn('Failed to cleanup file', { filePath, error });
  }
};

/**
 * Delete uploaded files and thumbnails
 */
export const deleteUploadedFiles = async (filePaths: string[]): Promise<void> => {
  try {
    await Promise.all(filePaths.map(filePath => cleanupFile(filePath)));
    logger.info('Uploaded files cleaned up', { count: filePaths.length });
  } catch (error) {
    logger.error('Failed to cleanup uploaded files', { filePaths, error });
  }
};

/**
 * Get file URL for serving
 */
export const getFileUrl = (filePath: string, baseUrl?: string): string => {
  const relativePath = path.relative(config.uploadPath, filePath);
  const url = relativePath.replace(/\\/g, '/'); // Convert Windows paths
  return baseUrl ? `${baseUrl}/uploads/${url}` : `/uploads/${url}`;
};

/**
 * Validate file exists and belongs to company
 */
export const validateFileAccess = async (
  filePath: string,
  companyId: string
): Promise<boolean> => {
  try {
    // Check if file exists
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return false;
    }

    // Check if file path contains company ID (basic security check)
    const normalizedPath = path.normalize(filePath);
    return normalizedPath.includes(companyId);
  } catch (error) {
    logger.error('File access validation failed', { filePath, companyId, error });
    return false;
  }
};

export default {
  uploadSingle,
  uploadMultiple,
  deleteUploadedFiles,
  getFileUrl,
  validateFileAccess,
};