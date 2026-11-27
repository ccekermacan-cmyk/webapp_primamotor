package id.primamotor.pos.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.data.repo.MasterRepository
import id.primamotor.pos.data.repo.MasterSave
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

data class MasterItem(
    val id: String,
    val kategori: String,
    val jenis: String,
    val label: String,
    val text2: String,
    val raw: LocalRecordEntity,
)

data class MasterSettingsUiState(
    val query: String = "",
    val jenisTab: String = "all",
    val draft: MasterDraft? = null,
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val deleteTarget: MasterItem? = null,
)

/** Pencerminan `pages/settings.tsx`: satu koleksi `dropdown`, dikelompokkan jenis + kategori. */
class MasterSettingsViewModel(
    container: AppContainer,
    private val operator: String,
    val isSuperAdmin: Boolean,
) : ViewModel() {

    private val masters: MasterRepository = container.masterRepository
    private val local = MutableStateFlow(MasterSettingsUiState())
    val state: StateFlow<MasterSettingsUiState> = local

    private val rows = container.repositories.observeMasterRows()

    val items: StateFlow<List<MasterItem>> = combine(rows, local) { records, state ->
        val query = state.query.trim().lowercase()
        records.mapNotNull { entity ->
            val row = entity.object_() ?: return@mapNotNull null
            val label = row.text("text_1")
            if (label.isBlank()) return@mapNotNull null
            MasterItem(
                id = entity.id,
                kategori = row.text("kategori"),
                jenis = row.text("jenis"),
                label = label,
                text2 = row.text("text_2"),
                raw = entity,
            )
        }.filter { item ->
            (state.jenisTab == "all" || item.jenis == state.jenisTab) &&
                (query.isBlank() || listOf(item.label, item.kategori, item.jenis, item.text2)
                    .any { it.lowercase().contains(query) })
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val jenisTabs: StateFlow<List<String>> = combine(items, local) { list, _ ->
        list.map { it.jenis }.filter { it.isNotBlank() }.distinct().sorted()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun setJenis(value: String) = local.update { it.copy(jenisTab = value) }

    fun add(jenis: String, kategori: String) = local.update {
        it.copy(
            draft = MasterDraft(kategori = kategori, jenis = jenis, operator = operator),
            error = null,
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
                linkImage = row?.text("link_image").orEmpty(),
                linkDokumen = row?.text("doc").orEmpty(),
                visibilitas = row?.text("visibilitas").orEmpty().ifBlank { "1,2,3,4,5,6,7" },
                idLama = row?.text("id_lama").orEmpty(),
                operator = operator,
            ),
            error = null,
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
            when (val result = masters.save(draft)) {
                is MasterSave.Saved -> local.update {
                    it.copy(
                        saving = false,
                        draft = null,
                        message = if (result.created) "Master data ditambahkan." else "Master data diperbarui.",
                    )
                }
                is MasterSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun askDelete(item: MasterItem) = local.update { it.copy(deleteTarget = item) }

    fun cancelDelete() = local.update { it.copy(deleteTarget = null) }

    fun confirmDelete() {
        val target = local.value.deleteTarget ?: return
        local.update { it.copy(deleteTarget = null) }
        viewModelScope.launch {
            val ok = masters.delete(target.id)
            local.update {
                it.copy(
                    message = if (ok) {
                        "Penghapusan masuk antrean. Server menolak jika hak akses tidak cukup."
                    } else {
                        "Data tidak ditemukan."
                    },
                )
            }
        }
    }

    fun clearMessage() = local.update { it.copy(message = null, error = null) }
}
