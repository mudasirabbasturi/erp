import apiClient from '../../api/client';

export const takeoffApi = {
    // Sessions
    getSessions: (params = {}) => apiClient.get('/takeoff/sessions', params),
    createSession: (data) => apiClient.post('/takeoff/sessions', data),
    getSession: (id) => apiClient.get(`/takeoff/sessions/${id}`),
    updateSession: (id, data) => apiClient.put(`/takeoff/sessions/${id}`, data),
    deleteSession: (id) => apiClient.delete(`/takeoff/sessions/${id}`),
    duplicateSession: (id) => apiClient.post(`/takeoff/sessions/${id}/duplicate`),

    // Blueprints
    uploadBlueprint: (sessionId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiClient.post(`/takeoff/sessions/${sessionId}/blueprints`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    selectBlueprintFromMedia: (sessionId, mediaId) => apiClient.post(`/takeoff/sessions/${sessionId}/blueprints/media`, { media_id: mediaId }),
    loadSampleBlueprint: (sessionId) => apiClient.post(`/takeoff/sessions/${sessionId}/blueprints/sample`),
    deleteBlueprint: (id) => apiClient.delete(`/takeoff/blueprints/${id}`),

    // Scales & Calibration
    getScales: (sessionId) => apiClient.get(`/takeoff/sessions/${sessionId}/scales`),
    saveScale: (sessionId, data) => apiClient.post(`/takeoff/sessions/${sessionId}/scales`, data),
    calibrateScale: (sessionId, data) => apiClient.post(`/takeoff/sessions/${sessionId}/scales/calibrate`, data),
    deleteScale: (id) => apiClient.delete(`/takeoff/scales/${id}`),

    // Measurements
    getMeasurements: (sessionId, params = {}) => apiClient.get(`/takeoff/sessions/${sessionId}/measurements`, params),
    batchSaveMeasurements: (sessionId, measurements) => apiClient.post(`/takeoff/sessions/${sessionId}/measurements`, { measurements }),
    updateMeasurement: (id, data) => apiClient.put(`/takeoff/measurements/${id}`, data),
    deleteMeasurement: (id) => apiClient.delete(`/takeoff/measurements/${id}`),
    bulkDeleteMeasurements: (ids) => apiClient.post('/takeoff/measurements/bulk-delete', { ids }),
    linkAssembly: (id, assemblyId) => apiClient.post(`/takeoff/measurements/${id}/link-assembly`, { assembly_id: assemblyId }),

    // Assemblies
    getAssemblies: (sessionId) => apiClient.get(`/takeoff/sessions/${sessionId}/assemblies`),
    saveAssembly: (sessionId, data) => apiClient.post(`/takeoff/sessions/${sessionId}/assemblies`, data),
    deleteAssembly: (id) => apiClient.delete(`/takeoff/assemblies/${id}`),
    saveAssemblyItem: (assemblyId, data) => apiClient.post(`/takeoff/assemblies/${assemblyId}/items`, data),
    deleteAssemblyItem: (id) => apiClient.delete(`/takeoff/assemblies/items/${id}`),

    // Totals & Export
    getTotals: (sessionId) => apiClient.get(`/takeoff/sessions/${sessionId}/totals`),
    exportSession: (sessionId, format = 'csv') => apiClient.post(`/takeoff/sessions/${sessionId}/export`, { format })
};

export default takeoffApi;

