import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import SlideOver from './SlideOver';
import Modal from './Modal';
import {
  createQuestionBankCategory,
  deleteQuestionBankCategory,
  listQuestionBankCategories,
  updateQuestionBankCategory,
} from '../services/questionBankCategories';

export default function QuestionBankCategoryManager({ isOpen, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');

  const [mode, setMode] = useState('create'); // create | edit
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listQuestionBankCategories();
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(
        list.map((x) => ({
          id: x.id,
          name: x.name,
          description: x.description || '',
        }))
      );
    } catch (e) {
      console.error('Failed to load categories', e);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    load();
    setSearch('');
    setMode('create');
    setEditingId(null);
    setName('');
    setDescription('');
    setCreateOpen(false);
  }, [isOpen]);

  const beginEdit = (c) => {
    setMode('edit');
    setEditingId(c.id);
    setName(c.name || '');
    setDescription(c.description || '');
  };

  const resetForm = () => {
    setMode('create');
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const submit = async () => {
    const n = (name || '').trim();
    if (!n) {
      toast.error('Name is required');
      return;
    }
    try {
      setSaving(true);
      if (mode === 'edit' && editingId != null) {
        await updateQuestionBankCategory(editingId, { name: n, description: (description || '').trim() || null });
        toast.success('Category updated');
      } else {
        await createQuestionBankCategory({ name: n, description: (description || '').trim() || null });
        toast.success('Category created');
      }
      await load();
      onChanged?.();
      resetForm();
      setCreateOpen(false);
    } catch (e) {
      console.error('Failed to save category', e);
      toast.error(e.response?.data?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    const ok = window.confirm(`Delete category "${c.name}"?`);
    if (!ok) return;
    try {
      await deleteQuestionBankCategory(c.id);
      toast.success('Category deleted');
      await load();
      onChanged?.();
      if (editingId === c.id) resetForm();
    } catch (e) {
      console.error('Failed to delete category', e);
      toast.error(e.response?.data?.message || 'Failed to delete category');
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Manage Categories" widthClass="max-w-3xl">
      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Search categories..."
            />
            <button
              type="button"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
              className="px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] whitespace-nowrap"
            >
              Create Category
            </button>
          </div>
          <div className="mt-4 border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-sm text-gray-500">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.description || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(c)}
                          className="px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(c)}
                          className="px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={createOpen || mode === 'edit'}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title={mode === 'edit' ? 'Edit Category' : 'Create Category'}
        maxWidthClass="max-w-xl"
      >
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Fall Protection"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="px-5 py-2 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] disabled:opacity-60"
            >
              {saving ? 'Saving...' : mode === 'edit' ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </div>
      </Modal>
    </SlideOver>
  );
}

