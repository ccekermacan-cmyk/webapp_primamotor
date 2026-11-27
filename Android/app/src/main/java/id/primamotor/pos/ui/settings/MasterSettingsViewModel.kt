package id.primamotor.pos.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.data.repo.MasterRepository
import id.primamotor.pos.data.repo.MasterSave
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.number
import id.primamotor.pos.data.repo.object_
import id.primamotor.pos.data.repo.text
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class MasterItem(
    val id: String,
    val kategori: String,
    val jenis: String,
    val label: String,
    val text2: String,
    val idLama: String,
    val number1: java.math.BigDecimal,
    val alamat: String,
    val phone: String,
    val visibilitas: String,
    val enum1: String,
    val enum2: String,
    val enum3: String,
    val enum4: String,
    val raw: LocalRecordEntity,
)

data class SettingsResult(val title: String, val message: String, val error: Boolean)

data class MasterSettingsUiState(
    val query: String = "",
    val jenisTab: String = "all",
    val draft: MasterDraft? = null,
    val detail: MasterItem? = null,
    val saving: Boolean = false,
    val deleting: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val result: SettingsResult? = null,
    val deleteTarget: MasterItem? = null,
    val deleteError: String? = null,
)

/** Pencerminan `pages/settings.tsx`: satu koleksi `dropdown`, dikelompokkan jenis + kategori. */
class MasterSettingsViewModel(
    container: AppContainer,
    private val operator: String,
    val isSuperAdmin: Boolean,
    private val sessions: id.primamotor.pos.data.remote.SessionManager = container.sessions,
) : ViewModel() {

    private val masters: MasterRepository = container.masterRepository
    private val repos: Repositories = container.repositories
    private val local = MutableStateFlow(MasterSettingsUiState())
    val state: StateFlow<MasterSettingsUiState> = local

    private val rows = repos.observeMasterRows()

    private val allItems: StateFlow<List<MasterItem>> = rows
        .let { flow ->
            combine(flow, local) { records, _ -> records.mapNotNull(::toItem) }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val items: StateFlow<List<MasterItem>> = combine(allItems, local) { records, state ->
        val query = state.query.trim().lowercase()
        records
            .filter { state.jenisTab == "all" || it.jenis == state.jenisTab }
            .filter { item ->
                query.isBlank() || listOf(item.label, item.kategori, item.jenis)
                    .any { it.lowercase().contains(query) }
            }
            .sortedWith(compareBy({ it.jenis.lowercase() }, { it.kategori.lowercase() }, { it.label.lowercase() }))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Pill jenis dengan jumlah seluruh data (bukan hasil pencarian), seperti web. */
    val jenisTabs: StateFlow<List<Pair<String, Int>>> = allItems
        .let { flow ->
            combine(flow, local) { records, _ ->
                records.filter { it.jenis.isNotBlank() }
                    .groupingBy { it.jenis }
                    .eachCount()
                    .toList()
                    .sortedBy { it.first.lowercase() }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val jenisOptions: StateFlow<List<String>> = allItems
        .let { flow ->
            combine(flow, local) { records, _ ->
                records.map { it.jenis }.filter { it.isNotBlank() }.distinct().sorted()
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val kategoriOptions: StateFlow<List<String>> = allItems
        .let { flow ->
            combine(flow, local) { records, _ ->
                records.map { it.kategori }.filter { it.isNotBlank() }.distinct().sorted()
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val userOptions: StateFlow<List<String>> = repos.observeUser()
        .let { flow ->
            combine(flow, local) { users, _ ->
                users.map { it.name.ifBlank { it.username } }.filter { it.isNotBlank() }.distinct()
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun setJenis(value: String) = local.update { it.copy(jenisTab = value) }

    fun showDetail(item: MasterItem) = local.update { it.copy(detail = item) }

    fun closeDetail() = local.update { it.copy(detail = null) }

    fun add(jenis: String, kategori: String) = local.update {
        it.copy(
            draft = MasterDraft(kategori = kategori, jenis = jenis, operator = operator),
            error = null,
            detail = null,
        )
    }

    fun edit(item: MasterItem) = local.update {
        val row = item.raw.object_()
        it.copy(
            draft = MasterDraft(
                id = item.id,
                kategori = item.kategori,
                jenis = item.jenis,
                text1 = item.label,
                text2 = item.text2,
                text3 = row?.text("text_3").orEmpty(),
                text4 = row?.text("text_4").orEmpty(),
                text5 = row?.text("text_5").orEmpty(),
                text6 = row?.text("text_6").orEmpty(),
                text7 = row?.text("text_7").orEmpty(),
                text8 = row?.text("text_8").orEmpty(),
                text9 = row?.text("text_9").orEmpty(),
                text10 = row?.text("text_10").orEmpty(),
                number1 = row?.number("number_1")?.stripTrailingZeros()?.toPlainString() ?: "0",
                number2 = row?.number("number_2")?.stripTrailingZeros()?.toPlainString() ?: "0",
                number3 = row?.number("number_3")?.stripTrailingZeros()?.toPlainString() ?: "0",
                number4 = row?.number("number_4")?.stripTrailingZeros()?.toPlainString() ?: "0",
                number5 = row?.number("number_5")?.stripTrailingZeros()?.toPlainString() ?: "0",
                enum1 = row?.text("enum_1").orEmpty(),
                enum2 = row?.text("enum_2").orEmpty(),
                enum3 = row?.text("enum_3").orEmpty(),
                enum4 = row?.text("enum_4").orEmpty(),
                alamat = row?.text("address").orEmpty(),
                phone = row?.text("phone").orEmpty(),
                latlong = row?.text("latlong").orEmpty(),
                linkImage = row?.text("link_image").orEmpty(),
                linkDokumen = row?.text("doc").orEmpty(),
                visibilitas = row?.text("visibilitas").orEmpty().ifBlank { "1,2,3,4,5,6,7" },
                idLama = item.idLama,
                operator = operator,
            ),
            error = null,
            detail = null,
        )
    }

    fun closeForm() = local.update { it.copy(draft = null, error = null) }

    fun updateDraft(block: (MasterDraft) -> MasterDraft) = local.update {
        it.copy(draft = it.draft?.let(block))
    }

    fun save() {
        val draft = local.value.draft ?: return
        if (local.value.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = masters.save(draft.copy(operator = operator))) {
                is MasterSave.Saved -> local.update {
                    it.copy(
                        saving = false,
                        draft = null,
                        result = SettingsResult(
                            "Tersimpan",
                            if (result.created) {
                                "Data master berhasil ditambahkan ke PocketBase."
                            } else {
                                "Data master berhasil diperbarui di PocketBase."
                            },
                            error = false,
                        ),
                    )
                }
                is MasterSave.Rejected -> local.update {
                    it.copy(saving = false, error = result.message, result = SettingsResult("Gagal Menyimpan", "Kendala: ${result.message}", error = true))
                }
            }
        }
    }

    fun askDelete(item: MasterItem) = local.update { it.copy(deleteTarget = item, deleteError = null) }

    fun cancelDelete() = local.update { it.copy(deleteTarget = null, deleteError = null) }

    /**
     * Hapus master data hanya untuk level 1 dan hanya bila server mengizinkan (`permissions/delete`).
     * Pemeriksaan butuh jaringan; offline ditolak supaya tombol tidak pernah menghapus buta.
     */
    fun confirmDelete() {
        val target = local.value.deleteTarget ?: return
        if (!isSuperAdmin) {
            local.update { it.copy(deleteError = "Akses tindakan ini ditolak.") }
            return
        }
        if (local.value.deleting) return
        local.update { it.copy(deleting = true) }
        viewModelScope.launch {
            val allowed = runCatching {
                val body = buildJsonObject {
                    put("records", kotlinx.serialization.json.buildJsonArray {
                        add(buildJsonObject {
                            put("collection", "dropdown")
                            put("id", target.id)
                        })
                    })
                }
                val response = sessions.call("/api/permissions/delete", "POST", body)
                response.toString().contains("\"allowed\":true")
            }.getOrNull() ?: false
            if (!allowed) {
                local.update {
                    it.copy(
                        deleting = false,
                        deleteError = "Penghapusan ditolak. Periksa koneksi dan hak akses.",
                        result = SettingsResult(
                            "Gagal Menghapus",
                            "Kendala: Penghapusan ditolak. Periksa koneksi dan hak akses.",
                            error = true,
                        ),
                    )
                }
                return@launch
            }
            val ok = masters.delete(target.id)
            local.update {
                it.copy(
                    deleting = false,
                    deleteTarget = null,
                    detail = null,
                    result = if (ok) {
                        SettingsResult("Berhasil Dihapus", "Data master telah dihapus dari PocketBase.", error = false)
                    } else {
                        SettingsResult("Gagal Menghapus", "Kendala: Data tidak ditemukan.", error = true)
                    },
                )
            }
        }
    }

    fun dismissResult() = local.update { it.copy(result = null) }

    fun clearMessage() = local.update { it.copy(message = null, error = null) }

    private fun toItem(entity: LocalRecordEntity): MasterItem? {
        val row = entity.object_() ?: return null
        val label = row.text("text_1")
        if (label.isBlank()) return null
        return MasterItem(
            id = entity.id,
            kategori = row.text("kategori"),
            jenis = row.text("jenis"),
            label = label,
            text2 = row.text("text_2"),
            idLama = row.text("id_lama"),
            number1 = row.number("number_1"),
            alamat = row.text("address"),
            phone = row.text("phone"),
            visibilitas = row.text("visibilitas"),
            enum1 = row.text("enum_1"),
            enum2 = row.text("enum_2"),
            enum3 = row.text("enum_3"),
            enum4 = row.text("enum_4"),
            raw = entity,
        )
    }
}

/** Label dinamis form web, cermin `getFieldLabel`. */
object MasterLabels {
    fun text1(kategori: String, jenis: String): String {
        val k = kategori.lowercase()
        val j = jenis.lowercase()
        return when {
            k == "cashflow" && j.contains("akun") -> "Nama Akun / Kas *"
            k == "cashflow" -> "Nama Transaksi *"
            k == "person" -> "Nama Pihak (Lengkap) *"
            k == "persenan" -> "Label Persentase *"
            k == "user" -> "Nama Jabatan / Level *"
            else -> "Label Utama (Text 1) *"
        }
    }

    fun text2(kategori: String): String = when (kategori.lowercase()) {
        "cashflow" -> "Tipe (in / out)"
        "person" -> "Nama Bengkel / Toko"
        else -> "Text 2"
    }

    fun number1(kategori: String, jenis: String): String = when {
        kategori.lowercase() == "cashflow" && jenis.lowercase().contains("akun") -> "Saldo Awal (Rp)"
        kategori.lowercase() == "person" -> "Limit / Saldo (Rp)"
        else -> "Number 1"
    }

    fun number2(kategori: String): String = when (kategori.lowercase()) {
        "person" -> "Tier / Level Harga (1-5)"
        "persenan" -> "Nilai Persentase (%)"
        "user" -> "ID / Kode Level"
        else -> "Number 2"
    }

    fun enum1(kategori: String, jenis: String): String =
        if (kategori.lowercase() == "cashflow" && jenis.lowercase().contains("akun")) {
            "Akses User (Enum 1)"
        } else {
            "Enum 1 (User)"
        }

    val levelOptions = listOf(
        "1" to "Level 1 (Super Admin)",
        "2" to "Level 2 (Admin)",
        "3" to "Level 3 (Manager)",
        "4" to "Level 4 (Supervisor)",
        "5" to "Level 5 (Kasir)",
        "6" to "Level 6 (Staff)",
        "7" to "Level 7 (Mekanik)",
        "10" to "Level 10 (Mekanik Senior)",
    )
}
