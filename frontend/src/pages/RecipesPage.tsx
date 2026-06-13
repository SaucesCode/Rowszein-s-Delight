import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes, useDeleteRecipe } from '@/hooks/useRecipes'
import type { Recipe } from '@/types/recipe.types'
import { Pencil, Trash2, Plus } from 'lucide-react'

export default function RecipesPage() {
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const { data, isLoading, isError } = useRecipes(page)
  const deleteRecipe = useDeleteRecipe()

  const recipes: Recipe[] = data?.data?.results ?? []
  const totalPages = Math.ceil((data?.data?.count ?? 0) / 20)

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return
    deleteRecipe.mutate(id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Recipes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define ingredients and production cost per product
          </p>
        </div>
        <button
          onClick={() => navigate('/recipes/new')}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus size={16} />
          Add Recipe
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}

      {isError && <p className="text-sm text-red-500">Failed to load recipes.</p>}

      {!isLoading && !isError && recipes.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No recipes yet.</p>
          <button
            onClick={() => navigate('/recipes/new')}
            className="mt-2 text-sm text-slate-600 underline"
          >
            Add your first recipe
          </button>
        </div>
      )}

      {recipes.length > 0 && (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Ingredients</th>
                  <th className="px-4 py-3 font-medium">Production Cost</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipes.map((recipe) => (
                  <tr key={recipe.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {recipe.product_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {recipe.recipe_ingredients.length} ingredient
                      {recipe.recipe_ingredients.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      ₱{Number(recipe.production_cost).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {recipe.notes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id)}
                          className="text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1 rounded border disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="text-sm px-3 py-1 rounded border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}