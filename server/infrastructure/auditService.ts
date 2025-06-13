import { supabaseAdmin } from './supabaseClient';
import { toSnakeCase } from '../utils/toSnakeCase';

/**
 * Base interface for all audit details
 * @property {string} timestamp - ISO timestamp of when the audit event occurred
 * @property {boolean} success - Whether the operation was successful
 * @property {string} [error] - Optional error message if the operation failed
 */
interface BaseAuditDetails {
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Text-to-Speech specific audit details
 * @extends BaseAuditDetails
 */
interface TTSAuditDetails extends BaseAuditDetails {
  textLength: number;
  voiceId: string;
  audioFormat: string;
  processingTime?: number;
  outputSize?: number;
}

/**
 * File upload specific audit details
 * @extends BaseAuditDetails
 */
interface FileUploadAuditDetails extends BaseAuditDetails {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
}

/**
 * User action specific audit details
 * @extends BaseAuditDetails
 */
interface UserActionAuditDetails extends BaseAuditDetails {
  actionType: 'login' | 'logout' | 'password_change' | 'settings_update';
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * API usage specific audit details
 * @extends BaseAuditDetails
 */
interface APIUsageAuditDetails extends BaseAuditDetails {
  endpoint: string;
  method: string;
  responseCode: number;
  responseTime: number;
  requestSize?: number;
  responseSize?: number;
}

/**
 * Union type for all possible audit details
 */
type AuditDetails = 
  | TTSAuditDetails 
  | FileUploadAuditDetails 
  | UserActionAuditDetails 
  | APIUsageAuditDetails;

/**
 * Represents an audit log entry in the database
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: AuditDetails;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

/**
 * Paginated response interface
 * @template T - The type of data being paginated
 */
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Service for managing audit logs
 * Handles creation and retrieval of audit logs with proper type safety and error handling
 */
export class AuditService {
  private readonly tableName = 'audit_logs';

  /**
   * Creates a new audit log entry
   * @param userId - The ID of the user performing the action
   * @param action - The type of action being performed
   * @param resource - The resource being acted upon
   * @param details - Specific details about the audit event
   * @param ipAddress - IP address of the user
   * @param userAgent - User agent string of the client
   * @throws {Error} If the database operation fails
   */
  async log(
    userId: string,
    action: string,
    resource: string,
    details: AuditDetails,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .insert(toSnakeCase({
          userId,
          action,
          resource,
          details,
          ipAddress,
          userAgent,
          createdAt: new Date().toISOString(),
        }));

      if (error) {
        throw new Error(`Failed to create audit log: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in audit logging:', error);
      throw error;
    }
  }

  /**
   * Retrieves audit logs with pagination and filtering
   * @param userId - Optional filter by user ID
   * @param action - Optional filter by action type
   * @param resource - Optional filter by resource
   * @param startDate - Optional filter by start date (inclusive)
   * @param endDate - Optional filter by end date (inclusive)
   * @param limit - Maximum number of records to return
   * @param offset - Number of records to skip
   * @returns Paginated response containing audit logs and pagination info
   */
  async getLogs(
    userId?: string,
    action?: string,
    resource?: string,
    startDate?: string,
    endDate?: string,
    limit = 100,
    offset = 0
  ): Promise<PaginatedResponse<AuditLog>> {
    try {
      // Build base query for both count and data
      const buildBaseQuery = (query: any) => {
        if (userId) {
          query = query.eq('user_id', userId);
        }
        if (action) {
          query = query.eq('action', action);
        }
        if (resource) {
          query = query.eq('resource', resource);
        }
        if (startDate) {
          query = query.gte('created_at', startDate);
        }
        if (endDate) {
          query = query.lte('created_at', endDate);
        }
        return query;
      };

      const { data, count, error } = await buildBaseQuery(
        supabaseAdmin
          .from(this.tableName)
          .select('*', { count: 'exact' })
      )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch audit logs: ${error.message}`);
      }

      const total = count || 0;
      const hasMore = offset + limit < total;

      return {
        data: data as AuditLog[],
        pagination: {
          total,
          limit,
          offset,
          hasMore
        }
      };
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }
}

export const auditService = new AuditService(); 