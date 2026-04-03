import axios from 'axios';

// The backend runs on port 8000
const API_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const CRMService = {
  getSystemStatus: async () => {
    const response = await api.get('/health');
    return response.data;
  },
  
  getLeads: async () => {
    // We might have a dedicated endpoint, but assuming /api/agents/generate-dashboard handles mock data or we can request via orchestrator
    // We'll scaffold mock data for UI visual demonstration if backend fails, but hit actual endpoints.
    try {
        const response = await api.get('/api/leads');
        return response.data;
    } catch {
        return [];
    }
  },

  getDashboardData: async () => {
      try {
          const response = await api.post('/api/agents/generate-dashboard', { category: 'sales' });
          return response.data;
      } catch (err) {
          console.error(err);
          return null;
      }
  }
};

export default api;
