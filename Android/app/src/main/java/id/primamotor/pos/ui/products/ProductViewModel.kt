package id.primamotor.pos.ui.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.repo.ProductDraft
import id.primamotor.pos.data.repo.ProductRepository
import id.primamotor.pos.data.repo.ProductSave
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.domain.BarcodeLookup
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProductsUiState(
    val query: String = "",
    val draft: ProductDraft? = null,
    val scanning: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

class ProductViewModel(
    private val repos: Repositories,
    private val writer: ProductRepository,
) : ViewModel() {

    private val local = MutableStateFlow(ProductsUiState())

    val state: StateFlow<ProductsUiState> = local

    private var cache: List<Produk> = emptyList()

    val products: StateFlow<List<Produk>> = combine(repos.observeProduk(), local) { rows, value ->
        cache = rows
        val query = value.query.trim().lowercase()
        if (query.isEmpty()) {
            rows
        } else {
            rows.filter { product ->
                product.nama.lowercase().contains(query) ||
                    product.barcode.contains(query) ||
                    product.idLama.lowercase().contains(query) ||
                    product.merk.lowercase().contains(query)
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun edit(product: Produk?) = local.update {
        it.copy(
            draft = if (product == null) {
                ProductDraft()
            } else {
                ProductDraft(
                    id = product.id,
                    nama = product.nama,
                    barcode = product.barcode,
                    idLama = product.idLama,
                    kategori = product.kategori,
                    merk = product.merk,
                    varian = product.varian,
                    tipe = product.tipe,
                    unit = product.unit,
                    beli = product.beli,
                    sell1 = product.sell1,
                    sell2 = product.sell2,
                    sell3 = product.sell3,
                    stok = product.stok,
                    min1 = product.min1,
                )
            },
            error = null,
            message = null,
        )
    }

    fun closeForm() = local.update { it.copy(draft = null) }

    fun openScanner() = local.update { it.copy(scanning = true) }

    fun closeScanner() = local.update { it.copy(scanning = false) }

    /** Barcode hasil scan mengisi field barcode; kalau produk sudah ada, buka formnya. */
    fun onScanned(code: String) {
        val match = BarcodeLookup.find(code, cache)
        if (match != null) {
            edit(match)
            local.update { it.copy(scanning = false, message = "Produk ditemukan: ${match.nama}") }
        } else {
            local.update { state ->
                val base = state.draft ?: ProductDraft()
                state.copy(scanning = false, draft = base.copy(barcode = code), message = "Barcode baru: $code")
            }
        }
    }

    fun updateDraft(block: (ProductDraft) -> ProductDraft) = local.update { state ->
        state.copy(draft = state.draft?.let(block))
    }

    fun save() {
        val draft = local.value.draft ?: return
        if (local.value.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = writer.save(draft)) {
                is ProductSave.Saved -> local.update {
                    it.copy(saving = false, draft = null, message = if (result.created) "Produk ditambahkan." else "Produk diperbarui.")
                }
                is ProductSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun clearMessage() = local.update { it.copy(message = null) }
}