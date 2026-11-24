// Every backend endpoint in one place, grouped by feature.
// Each function returns the response data directly.
import http from './httpClient.js';

const data = (response) => response.data;

export const authApi = {
  login: (body) => http.post('/auth/login', body).then(data),
  register: (body) => http.post('/auth/register', body).then(data),
  me: () => http.get('/auth/me').then(data),
};

export const projectApi = {
  list: () => http.get('/projects').then(data),
  create: (body) => http.post('/projects', body).then(data),
  importFile: (file) => http.post('/projects/import', { data: file }).then(data), // { project, source, requests }
  update: (id, body) => http.put(`/projects/${id}`, body).then(data),
  remove: (id) => http.delete(`/projects/${id}`),
  exportJson: (id) => http.get(`/projects/${id}/export`).then(data),
  tree: (id) => http.get(`/projects/${id}/tree`).then(data),
  members: (id) => http.get(`/projects/${id}/members`).then(data), // { owner, members }
  addMember: (id, body) => http.post(`/projects/${id}/members`, body).then(data), // { email, role }
  updateMember: (id, userId, body) => http.put(`/projects/${id}/members/${userId}`, body).then(data), // { role }
  removeMember: (id, userId) => http.delete(`/projects/${id}/members/${userId}`).then(data),
  move: (id, body) => http.put(`/projects/${id}/move`, body), // { type, id, parentId, orderedIds }
};

export const adminApi = {
  users: () => http.get('/admin/users').then(data), // { users, projects }
  updateUser: (id, body) => http.put(`/admin/users/${id}`, body).then(data), // { approved?, projectIds? }
};

export const folderApi = {
  create: (body) => http.post('/folders', body).then(data), // { projectId, parentId, name }
  rename: (id, name) => http.put(`/folders/${id}`, { name }).then(data),
  remove: (id) => http.delete(`/folders/${id}`),
};

export const requestApi = {
  create: (body) => http.post('/requests', body).then(data), // { projectId, folderId, name }
  get: (id) => http.get(`/requests/${id}`).then(data),
  update: (id, body) => http.put(`/requests/${id}`, body).then(data),
  remove: (id) => http.delete(`/requests/${id}`),
};

export const sampleApi = {
  list: (requestId) => http.get(`/requests/${requestId}/samples`).then(data),
  create: (requestId, body) => http.post(`/requests/${requestId}/samples`, body).then(data),
  remove: (requestId, sampleId) => http.delete(`/requests/${requestId}/samples/${sampleId}`),
};

export const executeApi = {
  send: (body) => http.post('/execute', body).then(data), // { method, url, headers, body }
};
