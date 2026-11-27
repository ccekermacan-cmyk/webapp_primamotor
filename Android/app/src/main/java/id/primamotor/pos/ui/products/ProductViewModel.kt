package id.primamotor.pos.ui.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.remote.SessionManager
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
    val filterStok: String = "all",
    val draft: ProductDraft? = null,
    val detail: Produk? = null,
    val scanning: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val deleteTarget: Produk? = null,
    val deletePassword: String = "",
    val deleteError: String? = null,
    val verifying: Boolean = false,
)

class ProductViewModel(
    private val repos: Repositories,
    private val writer: ProductRepository,
    private val sessions: SessionManager,
    private val identity: String,
    private val operator: String = identity,
) : ViewModel() {

    private val local = MutableStateFlow(ProductsUiState())

    val state: StateFlow<ProductsUiState> = local

    private var cache: List<Produk> = emptyList()

    val products: StateFlow<List<Produk>> = combine(repos.observeProduk(), local) { rows, value ->
        cache = rows
        val query = value.query.trim().lowercase()
        rows.filter { product ->
            val matchesQuery = query.isEmpty() ||
                product.nama.lowercase().contains(query) ||
                product.barcode.contains(query) ||
                product.idLama.lowercase().contains(query) ||
                product.merk.lowercase().contains(query) ||
                product.kategori.lowercase().contains(query)
            val matchesStock = when (value.filterStok) {
                "menipis" -> product.stok.signum() > 0 && product.stok <= product.min3
                "habis" -> product.stok.signum() <= 0
                else -> true
            }
            matchesQuery && matchesStock
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun setFilterStok(value: String) = local.update { it.copy(filterStok = value) }

    /** Tombol +/- stok di daftar, cermin `handleQuickStockChange` web. */
    fun adjustStock(product: Produk, delta: Int) {
        if (local.value.saving) return
        local.update { it.copy(saving = true) }
        viewModelScope.launch {
            when (val result = writer.adjustStock(product.id, delta, operator)) {
                is ProductSave.Saved -> local.update { it.copy(saving = false, message = "Stok ${product.nama} diperbarui.") }
                is ProductSave.Rejected -> local.update { it.copy(saving = false, message = result.message) }
            }
        }
    }

    fun show(product: Produk) = local.update { it.copy(detail = product) }

    fun closeDetail() = local.update { it.copy(detail = null) }

    fun edit(product: Produk?) = local.update {
        it.copy(draft = product?.let(::draftOf) ?: ProductDraft(), detail = null, error = null, message = null)
    }

    fun copy(product: Produk) = local.update {
        it.copy(draft = writer.copyOf(product), detail = null, error = null, message = null)
    }

    fun askDelete(product: Produk) = local.update {
        it.copy(deleteTarget = product, deletePassword = "", deleteError = null)
    }

    fun setDeletePassword(value: String) = local.update { it.copy(deletePassword = value, deleteError = null) }

    fun cancelDelete() = local.update { it.copy(deleteTarget = null, deletePassword = "", deleteError = null) }

    /**
     * Hapus produk wajib verifikasi password seperti web. Verifikasi butuh jaringan;
     * penghapusan sendiri tetap masuk outbox agar dieksekusi atomik oleh server.
     */
    fun confirmDelete() {
        val target = local.value.deleteTarget ?: return
        val password = local.value.deletePassword
        if (password.isBlank()) {
            local.update { it.copy(deleteError = "Password wajib diisi") }
            return
        }
        local.update { it.copy(verifying = true, deleteError = null) }
        viewModelScope.launch {
            val ok = sessions.verifyPassword(identity, password)
            if (!ok) {
                local.update { it.copy(verifying = false, deleteError = "Verifikasi gagal. Periksa password dan koneksi.") }
                return@launch
            }
            val deleted = writer.delete(target.id)
            local.update {
                it.copy(
                    verifying = false,
                    deleteTarget = null,
                    deletePassword = "",
                    detail = null,
                    message = if (deleted) "Produk dihapus. Server mengeksekusi saat tersambung." else "Produk tidak ditemukan di cache.",
                )
            }
        }
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

    private fun draftOf(product: Produk) = ProductDraft(
        id = product.id,
        nama = product.nama,
        barcode = product.barcode,
        idLama = product.idLama,
        kategori = product.kategori,
        merk = product.merk,
        jenis = product.jenis,
        varian = product.varian,
        keterangan = product.keterangan,
        tipe = product.tipe,
        unit = product.unit,
        beli = product.beli,
        sell1 = product.sell1,
        sell2 = product.sell2,
        sell3 = product.sell3,
        sell4 = product.sell4,
        sell5 = product.sell5,
        sell6 = product.sell6,
        stok = product.stok,
        min1 = product.min1,
        min2 = product.min2,
        min3 = product.min3,
    )
}
