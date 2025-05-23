import { supabaseAdmin } from './supabaseClient';

// Base interface for all audit details
interface BaseAuditDetails {
  timestamp: string;
  success: boolean;
  error?: string;
}

// Text-to-Speech specific audit details
interface TTSAuditDetails extends BaseAuditDetails {
  textLength: number;
  voiceId: string;
  audioFormat: string;
  processingTime?: number;
  outputSize?: number;
}

// File upload specific audit details
interface FileUploadAuditDetails extends BaseAuditDetails {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
}

// User action specific audit details
interface UserActionAuditDetails extends BaseAuditDetails {
  actionType: 'login' | 'logout' | 'password_change' | 'settings_update';
  previousValue?: any;
  newValue?: any;
}

// API usage specific audit details
interface APIUsageAuditDetails extends BaseAuditDetails {
  endpoint: string;
  method: string;
  responseCode: number;
  responseTime: number;
  requestSize?: number;
  responseSize?: number;
}

// Union type for all possible audit details
type AuditDetails = 
  | TTSAuditDetails 
  | FileUploadAuditDetails 
  | UserActionAuditDetails 
  | APIUsageAuditDetails;

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

// Add new interface for paginated response
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class AuditService {
  private readonly tableName = 'audit_logs';

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
        .insert({
          user_id: userId,
          action,
          resource,
          details,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to create audit log:', error);
      }
    } catch (error) {
      console.error('Error in audit logging:', error);
    }
  }

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

      // Get total count
      const countQuery = buildBaseQuery(
        supabaseAdmin
          .from(this.tableName)
          .select('*', { count: 'exact', head: true })
      );

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Failed to fetch audit log count:', countError);
        return {
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false
          }
        };
      }

      // Get paginated data
      const dataQuery = buildBaseQuery(
        supabaseAdmin
          .from(this.tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
      );

      const { data, error: dataError } = await dataQuery;

      if (dataError) {
        console.error('Failed to fetch audit logs:', dataError);
        return {
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false
          }
        };
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
      return {
        data: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false
        }
      };
    }
  }
}

export const auditService = new AuditService(); 