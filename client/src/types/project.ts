export interface Project {
  id: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  user_id: string;
} 