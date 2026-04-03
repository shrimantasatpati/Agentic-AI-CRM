import axios from 'axios';

const API_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

const handleError = (error) => {
  console.error('API Error:', error?.response?.data || error.message || error);
  throw error;
};

export const CRMService = {
  getHealth: async () => {
    try {
      const response = await api.get('/');
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  getLeads: async (params = { skip: 0, limit: 100 }) => {
    try {
      const response = await api.get('/api/leads', { params });
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  createLead: async (payload) => {
    try {
      const response = await api.post('/api/leads', payload);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  deleteLead: async (id) => {
    try {
      const response = await api.delete(`/api/leads/${id}`);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  getDashboard: async () => {
    try {
      const response = await api.get('/api/analytics/dashboard');
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  getPipeline: async () => {
    try {
      const response = await api.get('/api/analytics/pipeline');
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },
};

export default api;

