// Learning Pathways service: manage pathways, course mappings, and user assignments
// Expected backend endpoints:
// GET /api/admin/user-groups -> { items: [{ id, name, description, courseCount, userCount }] }
// GET /api/admin/user-groups/:id -> { id, name, description, courseIds: [], userIds: [] }
// POST /api/admin/user-groups -> { id }
// PUT /api/admin/user-groups/:id -> success
// DELETE /api/admin/user-groups/:id -> success

export async function listUserGroups(search = '') {
  const q = (search || '').trim();
  const url = `/api/admin/user-groups${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items;
  } catch (_err) {
    // Mock fallback
    const mock = [
      { id: 'ug-1', name: 'Marketing Team', description: 'All marketing department staff', courseCount: 3, userCount: 12 },
      { id: 'ug-2', name: 'Sales Team', description: 'Sales representatives', courseCount: 2, userCount: 8 },
      { id: 'ug-3', name: 'Engineering', description: 'Development and QA', courseCount: 5, userCount: 25 },
      { id: 'ug-4', name: 'New Hires 2025', description: 'Onboarding group', courseCount: 4, userCount: 15 },
    ];
    if (!q) return mock;
    const lower = q.toLowerCase();
    return mock.filter((m) => m.name.toLowerCase().includes(lower) || (m.description || '').toLowerCase().includes(lower));
  }
}

export async function getUserGroup(groupId) {
  try {
    const res = await fetch(`/api/admin/user-groups/${encodeURIComponent(groupId)}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (_err) {
    // Mock
    return {
      id: groupId,
      name: 'Sample Group',
      description: 'Mock group for editing',
      courseIds: ['c1', 'c2'],
      userIds: ['u1', 'u2', 'u3']
    };
  }
}

export async function saveUserGroup(group, _isEdit = false) {
  await new Promise((r) => setTimeout(r, 500));
  return { id: group.id || 'ug-' + Math.random().toString(36).slice(2, 8) };
}

export async function deleteUserGroup(_groupId) {
  await new Promise((r) => setTimeout(r, 300));
  return { success: true };
}

// For selecting users to add to group (returns user list)
export async function listUsers(search = '') {
  const q = (search || '').trim();
  try {
    const res = await fetch(`/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  } catch {
    // Mock
    const mock = [
      { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com' },
      { id: 'u2', name: 'Bob Smith', email: 'bob@example.com' },
      { id: 'u3', name: 'Carol Davis', email: 'carol@example.com' },
    ];
    if (!q) return mock;
    const lower = q.toLowerCase();
    return mock.filter((u) => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
  }
}

// For selecting courses to map to group (reuse existing courses if available)
export async function listCoursesForMapping(search = '') {
  const q = (search || '').trim();
  try {
    const res = await fetch(`/api/admin/courses${q ? `?search=${encodeURIComponent(q)}` : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  } catch {
    const mock = [
      { id: 'c1', title: 'Cyber Security Essentials', category: 'Security' },
      { id: 'c2', title: 'GDPR Compliance', category: 'Compliance' },
      { id: 'c3', title: 'Effective Communication', category: 'Soft Skills' },
      { id: 'c4', title: 'Employee Engagement', category: 'HR' },
    ];
    if (!q) return mock;
    const lower = q.toLowerCase();
    return mock.filter((c) => c.title.toLowerCase().includes(lower));
  }
}
