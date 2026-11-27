package id.primamotor.pos.ui.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.repo.ProductDraft
import id.primamotor.pos.data.repo.ProductLog
import id.primamotor.pos.data.repo.ProductRepository
import id.primamotor.pos.data.repo.ProductSave
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.domain.BarcodeLookup
import id.primamotor.pos.domain.ProductFeed
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class ProductsUiState(
    val query: String = "",
    val filterKategori: String = "all",
    val filterStok: String = "all",
    val sortField: String = "id_lama",
    val sortOrder: String = "asc",
    val page: Int = 1,
    val perPage: Int = 12,
    val viewMode: String = "grid",
    val showFilters: Boolean = false,
    val draft: ProductDraft? = null,
    val detailId: String? = null,
    val detailLogs: List<ProductLog> = emptyList(),
    val detailLogPage: Int = 1,
    val detailLogPages: Int = 1,
    val related: List<Produk> = emptyList(),
    val canDelete: Boolean = false,
    val copyTarget: Produk? = null,
    val scanning: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val deleteTarget: Produk? = null,
    val deletePassword: String = "",
    val deleteError: String? = null,
    val verifying: Boolean = false,
    val level: Int = 1,
) {
    val showMargin: Boolean get() = level == 1 || level == 2 || level == 5 || level == 6
}

data class ProductsPage(
    val rows: List<Produk> = emptyList(),
    val total: Int = 0,
    val totalPages: Int = 1,
    val page: Int = 1,
)

class ProductViewModel(
    private val repos: Repositories,
    private val writer: ProductRepository,
    private val sessions: SessionManager,
    private val identity: String,
    private val operator: String = identity,
    level: Int = 1,
) : ViewModel() {

    private val local = MutableStateFlow(ProductsUiState(level = level))

    val state: StateFlow<ProductsUiState> = local

    private var cache: List<Produk> = emptyList()

    /** Daftar produk terfilter + urutan, cermin `fetchProducts` web tetapi lokal. */
    private val filtered: StateFlow<List<Produk>> =
        combine(repos.observeProduk(), local) { rows, value ->
            cache = rows
            ProductFeed.apply(
                rows,
                ProductFeed.Filter(
                    query = value.query,
                    kategori = value.filterKategori,
                    stok = value.filterStok,
                    sort = value.sortField,
                    ascending = value.sortOrder == "asc",
                ),
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val products: StateFlow<ProductsPage> = combine(filtered, local) { rows, value ->
        val (pageRows, pages) = ProductFeed.slice(rows, value.page, value.perPage)
        ProductsPage(pageRows, rows.size, pages, value.page.coerceIn(1, pages))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ProductsPage())

    val kategoriOptions: StateFlow<List<String>> = combine(repos.observeProduk(), local) { rows, _ ->
        rows.map { it.kategori }.filter { it.isNotBlank() }.distinct().sorted()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val detail: StateFlow<Produk?> = combine(repos.observeProduk(), local) { rows, value ->
        value.detailId?.let { id -> rows.firstOrNull { it.id == id } }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun setQuery(value: String) = local.update { it.copy(query = value, page = 1) }

    fun setFilterKategori(value: String) = local.update { it.copy(filterKategori = value, page = 1) }

    fun setFilterStok(value: String) = local.update { it.copy(filterStok = value, page = 1) }

    fun toggleFilters() = local.update { it.copy(showFilters = !it.showFilters) }

    fun setViewMode(value: String) = local.update { it.copy(viewMode = value) }

    fun setPage(value: Int) = local.update { it.copy(page = value.coerceAtLeast(1)) }

    /** Ganti perPage selalu kembali ke halaman 1, sama seperti `useEffect([perPage])` web. */
    fun setPerPage(value: Int) = local.update {
        if (it.perPage == value) it else it.copy(perPage = value, page = 1)
    }

    /** Klik header kolom: kolom sama membalik arah, kolom baru mulai asc. */
    fun sort(field: String) = local.update {
        if (it.sortField == field) {
            it.copy(sortOrder = if (it.sortOrder == "asc") "desc" else "asc", page = 1)
        } else {
            it.copy(sortField = field, sortOrder = "asc", page = 1)
        }
    }

    /** Tombol +/- stok di daftar, cermin `handleQuickStockChange` web. */
    fun adjustStock(product: Produk, delta: Int) {
        if (local.value.saving) return
        local.update { it.copy(saving = true) }
        viewModelScope.launch {
            when (val result = writer.adjustStock(product.id, delta, operator)) {
                is ProductSave.Saved -> {
                    local.update { it.copy(saving = false, message = "Stok berhasil disesuaikan.") }
                    refreshLogs()
                }
                is ProductSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun openDetail(product: Produk) {
        local.update {
            it.copy(
                detailId = product.id,
                detailLogs = emptyList(),
                detailLogPage = 1,
                detailLogPages = 1,
                related = ProductFeed.related(cache, product),
                canDelete = false,
                error = null,
            )
        }
        refreshLogs()
        checkDeleteAccess(product)
    }

    fun closeDetail() = local.update { it.copy(detailId = null, detailLogs = emptyList(), related = emptyList()) }

    fun setLogPage(page: Int) {
        local.update { it.copy(detailLogPage = page.coerceAtLeast(1)) }
        refreshLogs()
    }

    private fun refreshLogs() {
        val state = local.value
        val id = state.detailId ?: return
        viewModelScope.launch {
            val (rows, pages) = repos.productLogs(id, state.detailLogPage)
            local.update { it.copy(detailLogs = rows, detailLogPages = pages) }
        }
    }

    /**
     * Tombol hapus web hanya muncul bila `permissions/delete` mengizinkan (stok nol dan tanpa
     * riwayat). Pemeriksaan ini butuh jaringan; saat offline tombol disembunyikan.
     */
    private fun checkDeleteAccess(product: Produk) {
        if (local.value.level != 1) return
        viewModelScope.launch {
            val allowed = runCatching {
                val body = buildJsonObject {
                    put("records", kotlinx.serialization.json.buildJsonArray {
                        add(buildJsonObject {
                            put("collection", "produk")
                            put("id", product.id)
                        })
                    })
                }
                val result = sessions.call("/api/permissions/delete", "POST", body)
                result.toString().contains("\"allowed\":true")
            }.getOrDefault(false)
            local.update { if (it.detailId == product.id) it.copy(canDelete = allowed) else it }
        }
    }

    fun edit(product: Produk?) = local.update {
        it.copy(
            draft = product?.let(::draftOf) ?: ProductDraft(unit = "pcs"),
            detailId = null,
            error = null,
            message = null,
        )
    }

    /** Dialog salin dulu, seperti `ProductCopyModal` web. */
    fun requestCopy(product: Produk) = local.update { it.copy(copyTarget = product) }

    fun cancelCopy() = local.update { it.copy(copyTarget = null) }

    fun confirmCopy() {
        val target = local.value.copyTarget ?: return
        local.update { it.copy(copyTarget = null, draft = writer.copyOf(target), detailId = null, error = null) }
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
        if (local.value.level != 1) {
            local.update { it.copy(deleteError = "Hanya level 1 yang boleh menghapus.") }
            return
        }
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
                    detailId = null,
                    message = if (deleted) "Produk berhasil dihapus." else "Produk tidak ditemukan di cache.",
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
            local.update { it.copy(scanning = false, message = "Produk ditemukan: ${ProductFeed.fullName(match)}") }
        } else {
            local.update { state ->
                val base = state.draft ?: ProductDraft(unit = "pcs")
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
            when (val result = writer.save(draft, operator)) {
                is ProductSave.Saved -> local.update {
                    it.copy(saving = false, draft = null, message = if (result.created) "Produk berhasil ditambahkan." else "Produk berhasil diperbarui.")
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
        stok1 = product.stok1,
        stok2 = product.stok2,
        min1 = product.min1,
        min2 = product.min2,
        min3 = product.min3,
    )
}
