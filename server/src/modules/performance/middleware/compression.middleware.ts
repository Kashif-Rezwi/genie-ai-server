import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';

export interface CompressionOptions {
  threshold?: number; // Minimum size to compress (bytes)
  level?: number; // Compression level (1-9)
  chunkSize?: number; // Chunk size for streaming
  memLevel?: number; // Memory level (1-9)
  strategy?: number; // Compression strategy
}

/**
 * High-performance compression middleware
 * Compresses responses based on content type and size
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CompressionMiddleware.name);
  private readonly options: CompressionOptions;

  constructor() {
    this.options = {
      threshold: 1024, // 1KB minimum
      level: 6, // Balanced compression
      chunkSize: 16 * 1024, // 16KB chunks
      memLevel: 8, // Memory level
      strategy: zlib.constants.Z_DEFAULT_STRATEGY,
    };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Check if client accepts compression
    const acceptEncoding = req.headers['accept-encoding'] as string;
    if (!acceptEncoding || !this.supportsCompression(acceptEncoding)) {
      return next();
    }

    // Store original methods
    const originalWrite = res.write;
    const originalEnd = res.end;
    const originalWriteHead = res.writeHead;

    let compressed = false;
    let compressionType: string;
    let compressor: zlib.Gzip | zlib.Deflate | zlib.BrotliCompress;

    // Determine compression type
    if (acceptEncoding.includes('br')) {
      compressionType = 'br';
      compressor = zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level || 6,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0,
        },
      });
    } else if (acceptEncoding.includes('gzip')) {
      compressionType = 'gzip';
      compressor = zlib.createGzip({
        level: this.options.level,
        chunkSize: this.options.chunkSize,
        memLevel: this.options.memLevel,
        strategy: this.options.strategy,
      });
    } else if (acceptEncoding.includes('deflate')) {
      compressionType = 'deflate';
      compressor = zlib.createDeflate({
        level: this.options.level,
        chunkSize: this.options.chunkSize,
        memLevel: this.options.memLevel,
        strategy: this.options.strategy,
      });
    } else {
      return next();
    }

    // Buffer to collect response data
    const chunks: Buffer[] = [];
    let totalSize = 0;

    // Override write method
    res.write = function (chunk: any, encoding?: any, cb?: any): boolean {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        chunks.push(buffer);
        totalSize += buffer.length;
      }
      return true;
    };

    // Override end method
    const self = this;
    res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        chunks.push(buffer);
        totalSize += buffer.length;
      }

      // Check if we should compress
      if (totalSize >= self.options.threshold! && self.shouldCompress(res)) {
        self.compressResponse(res, chunks, compressionType, compressor, originalEnd);
      } else {
        // Send uncompressed
        self.sendUncompressed(res, chunks, originalEnd);
      }

      return res;
    };

    // Override writeHead to set compression headers
    res.writeHead = function (statusCode: number, statusMessage?: any, headers?: any): Response {
      if (compressed) {
        if (typeof statusMessage === 'object') {
          headers = statusMessage;
          statusMessage = undefined;
        }
        if (!headers) headers = {};
        headers['Content-Encoding'] = compressionType;
        headers['Vary'] = 'Accept-Encoding';
      }
      if (headers) {
        return (originalWriteHead as any).call(res, statusCode, statusMessage, headers);
      } else {
        return originalWriteHead.call(res, statusCode, statusMessage);
      }
    };

    next();
  }

  /**
   * Check if client supports compression
   * @param acceptEncoding - Accept-Encoding header value
   * @returns boolean - Whether compression is supported
   */
  private supportsCompression(acceptEncoding: string): boolean {
    return acceptEncoding.includes('gzip') || 
           acceptEncoding.includes('deflate') || 
           acceptEncoding.includes('br');
  }

  /**
   * Check if response should be compressed
   * @param res - Response object
   * @returns boolean - Whether to compress
   */
  private shouldCompress(res: Response): boolean {
    const contentType = res.getHeader('Content-Type') as string;
    if (!contentType) return false;

    // Compress text-based content types
    const compressibleTypes = [
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'text/xml',
      'text/csv',
    ];

    return compressibleTypes.some(type => contentType.includes(type));
  }

  /**
   * Compress and send response
   * @param res - Response object
   * @param chunks - Response chunks
   * @param compressionType - Type of compression
   * @param compressor - Compression stream
   * @param originalEnd - Original end method
   */
  private compressResponse(
    res: Response,
    chunks: Buffer[],
    compressionType: string,
    compressor: zlib.Gzip | zlib.Deflate | zlib.BrotliCompress,
    originalEnd: Function,
  ): void {
    const data = Buffer.concat(chunks);
    
    // Set compression headers
    res.setHeader('Content-Encoding', compressionType);
    res.setHeader('Vary', 'Accept-Encoding');
    res.removeHeader('Content-Length'); // Let compression handle this

    // Compress data
    compressor.on('data', (chunk: Buffer) => {
      res.write(chunk);
    });

    compressor.on('end', () => {
      originalEnd.call(res);
    });

    compressor.on('error', (error: Error) => {
      this.logger.warn('Compression error, sending uncompressed:', error);
      this.sendUncompressed(res, chunks, originalEnd);
    });

    compressor.write(data);
    compressor.end();
  }

  /**
   * Send uncompressed response
   * @param res - Response object
   * @param chunks - Response chunks
   * @param originalEnd - Original end method
   */
  private sendUncompressed(res: Response, chunks: Buffer[], originalEnd: Function): void {
    for (const chunk of chunks) {
      res.write(chunk);
    }
    originalEnd.call(res);
  }
}
