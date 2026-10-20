'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

type Family = {
  _id: string;
  name: string;
  description?: string | null;
  owner_cpf?: string | null;
  created_at: string;
  updated_at: string;
};

export default function FamiliesPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerCpf, setOwnerCpf] = useState('');
  const [familyId, setFamilyId] = useState('');

  const isSuperAdmin = user?.role === 'USERADMINSUPER';

  const fetchFamilies = async () => {
    try {
      setLoading(true);
      const res = await api.get<Family[]>('/families/');
      setFamilies(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Falha ao carregar famílias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    try {
      setCreating(true);
      const payload: any = { name: name.trim() };
      if (description.trim()) payload.description = description.trim();
      if (ownerCpf.trim()) payload.owner_cpf = ownerCpf.trim();
      if (familyId.trim()) payload.family_id = familyId.trim();
      await api.post('/families/', payload);
      setName('');
      setDescription('');
      setOwnerCpf('');
      setFamilyId('');
      await fetchFamilies();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Falha ao criar família');
    } finally {
      setCreating(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Famílias</h1>
        <p className="text-gray-600">Acesso restrito ao SuperAdmin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gerenciar Famílias</h1>

      {/* Formulário de criação */}
      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome da família</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Família Silva"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Descrição (opcional)</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Alguma observação"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              CPF do responsável (opcional)
            </label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              value={ownerCpf}
              onChange={(e) => setOwnerCpf(e.target.value)}
              placeholder="Somente números"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              ID da família (opcional)
            </label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              placeholder="Se vazio, será gerado automaticamente"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary-700 disabled:opacity-60"
          >
            {creating ? 'Criando...' : 'Criar Família'}
          </button>
        </div>
      </form>

      {/* Lista de famílias */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Famílias cadastradas</h2>
        </div>
        {loading ? (
          <div className="p-4 text-gray-600">Carregando...</div>
        ) : families.length === 0 ? (
          <div className="p-4 text-gray-600">Nenhuma família encontrada.</div>
        ) : (
          <ul className="divide-y">
            {families.map((fam) => (
              <li key={fam._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{fam.name}</p>
                  <p className="text-sm text-gray-500">ID: {fam._id}</p>
                  {fam.owner_cpf ? (
                    <p className="text-sm text-gray-500">Responsável (CPF): {fam.owner_cpf}</p>
                  ) : null}
                </div>
                <div className="text-xs text-gray-400">
                  Criada em {new Date(fam.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
