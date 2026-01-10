import React, { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Search, Loader } from 'lucide-react';

export function JurisprudenciaPage() {
  const [query, setQuery] = useState('');
  const [tribunal, setTribunal] = useState('stj');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResultados([]);

    try {
      const response = await fetch(
        `/api/jurisprudencia/search?query=${encodeURIComponent(query)}&tribunal=${tribunal}`
      );
      const data = await response.json();
      setResultados(data.resultados || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-stone-800">
            Pesquisa de Jurisprudência
          </h1>
          <p className="text-stone-600 mt-1">
            Busque decisões nos tribunais superiores
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Tribunal
                  </label>
                  <select
                    value={tribunal}
                    onChange={(e) => setTribunal(e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg"
                  >
                    <option value="stj">STJ - Superior Tribunal de Justiça</option>
                    <option value="stf">STF - Supremo Tribunal Federal</option>
                    <option value="tjsp">TJSP - Tribunal de Justiça de SP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Termo de Busca
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Ex: recurso especial, dano moral..."
                      className="flex-1 px-4 py-2 border border-stone-300 rounded-lg"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="px-6 py-2 bg-bronze-600 text-white rounded-lg hover:bg-bronze-700 disabled:opacity-50"
                    >
                      {loading ? <Loader className="animate-spin" /> : <Search />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {resultados.length > 0 && (
              <div className="space-y-4">
                {resultados.map((resultado) => (
                  <div key={resultado.id} className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="font-semibold text-stone-800 mb-2">
                      {resultado.numero}
                    </h3>
                    <p className="text-sm text-stone-600 mb-2">
                      {resultado.data}
                    </p>
                    <p className="text-stone-700">
                      {resultado.ementa}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
