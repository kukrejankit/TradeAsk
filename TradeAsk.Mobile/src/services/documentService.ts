import { API_URL } from './config';
import { authStorage } from './authStorage';
import type { Document } from '../types/admin';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await authStorage.getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const documentService = {
  async upload(fileUri: string, fileName: string, fileType: string, category: string): Promise<{ id: string }> {
    const token = await authStorage.getAdminToken();
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: fileName, type: fileType } as any);
    formData.append('category', category);

    const res = await fetch(`${API_URL}/admin/documents/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload document');
    return res.json();
  },

  async getDocuments(category?: string): Promise<Document[]> {
    const params = category ? `?category=${category}` : '';
    const res = await fetch(`${API_URL}/admin/documents${params}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/admin/documents/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  async reprocessDocument(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/admin/documents/${id}/reprocess`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reprocess document');
  },

  async getStats(): Promise<any> {
    const res = await fetch(`${API_URL}/admin/documents/stats`, { headers: await authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch document stats');
    return res.json();
  },
};
