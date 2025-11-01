// Users service: manage users, group assignments
// Expected backend endpoints:
// GET /api/admin/users?search=... -> { items: [{ id, firstName, lastName, email, groupCount, status }] }
// GET /api/admin/users/:id -> { id, firstName, lastName, email, groupIds: [], role, status }
// POST /api/admin/users -> { id }
// PUT /api/admin/users/:id -> success
// DELETE /api/admin/users/:id -> success

export async function listUsers(search = '') {
  const q = (search || '').trim();
  const url = `/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items;
  } catch (_err) {
    // Mock fallback
    const mock = [
      { id: 'u1', firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', role: 'Learner', groupNames: ['Engineering Team', 'Product Training'], joinedDate: '2024-01-15', status: 'Active' },
      { id: 'u2', firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', role: 'Learner', groupNames: ['Sales Team'], joinedDate: '2024-02-20', status: 'Active' },
      { id: 'u3', firstName: 'Carol', lastName: 'Davis', email: 'carol@example.com', role: 'Admin', groupNames: ['Engineering Team', 'Marketing Team', 'Leadership'], joinedDate: '2023-11-10', status: 'Active' },
      { id: 'u4', firstName: 'David', lastName: 'Wilson', email: 'david@example.com', role: 'Learner', groupNames: [], joinedDate: '2024-03-05', status: 'Inactive' },
      { id: 'u5', firstName: 'Emma', lastName: 'Brown', email: 'emma@example.com', role: 'Learner', groupNames: ['Product Training', 'New Hires'], joinedDate: '2024-04-12', status: 'Active' },
      { id: 'u6', firstName: 'Frank', lastName: 'Miller', email: 'frank@example.com', role: 'Admin', groupNames: ['Leadership', 'Engineering Team'], joinedDate: '2023-08-22', status: 'Active' },
      { id: 'u7', firstName: 'Grace', lastName: 'Lee', email: 'grace@example.com', role: 'Learner', groupNames: ['Marketing Team'], joinedDate: '2024-05-18', status: 'Active' },
      { id: 'u8', firstName: 'Henry', lastName: 'Taylor', email: 'henry@example.com', role: 'Admin', groupNames: ['Product Training'], joinedDate: '2023-12-03', status: 'Active' },
      { id: 'u9', firstName: 'Iris', lastName: 'Anderson', email: 'iris@example.com', role: 'Learner', groupNames: ['Sales Team', 'New Hires'], joinedDate: '2024-06-25', status: 'Suspended' },
      { id: 'u10', firstName: 'Jack', lastName: 'Thomas', email: 'jack@example.com', role: 'Learner', groupNames: ['Engineering Team'], joinedDate: '2024-07-08', status: 'Active' },
    ];
    if (!q) return mock;
    const lower = q.toLowerCase();
    return mock.filter((u) => 
      u.firstName.toLowerCase().includes(lower) || 
      u.lastName.toLowerCase().includes(lower) || 
      u.email.toLowerCase().includes(lower)
    );
  }
}

export async function getUser(userId) {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (_err) {
    // Mock
    return {
      id: userId,
      firstName: 'Sample',
      lastName: 'User',
      email: 'sample@example.com',
      groupIds: ['ug-1', 'ug-2'],
      role: 'learner',
      status: 'Active'
    };
  }
}

export async function saveUser(user, _isEdit = false) {
  await new Promise((r) => setTimeout(r, 500));
  return { id: user.id || 'u-' + Math.random().toString(36).slice(2, 8) };
}

export async function deleteUser(_userId) {
  await new Promise((r) => setTimeout(r, 300));
  return { success: true };
}
