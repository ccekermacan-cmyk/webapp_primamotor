package id.primamotor.pos.ui.person

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.EmployeeDraft
import id.primamotor.pos.data.repo.EmployeeRepository
import id.primamotor.pos.data.repo.EmployeeSave
import id.primamotor.pos.data.repo.GajiRow
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.data.repo.MasterRepository
import id.primamotor.pos.data.repo.MasterSave
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.domain.PersonFeed
import id.primamotor.pos.domain.PersonSummary
import id.primamotor.pos.domain.PersonTab
import kotlinx.coroutines.Job
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class PersonDetailTab { PERSON_OVERVIEW, PERSON_HISTORY, USER_OVERVIEW, USER_GAJI, USER_BON }

data class PersonUiState(
    val tab: PersonTab = PersonTab.ALL,
    val searchInput: String = "",
    val query: String = "",
    val page: Int = 1,
    val perPage: Int = 8,
    val levelFilter: String = "all",
    val statusFilter: String = "all",
    val personDraft: MasterDraft? = null,
    val employeeDraft: EmployeeDraft? = null,
    val detailPerson: PersonRow? = null,
    val detailEmployee: UserRow? = null,
    val detailTab: PersonDetailTab = PersonDetailTab.PERSON_OVERVIEW,
    val historyPage: Int = 1,
    val gajiPage: Int = 1,
    val bonPage: Int = 1,
    val slip: GajiRow? = null,
    val saving: Boolean = false,
    val deleting: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val deletePerson: PersonRow? = null,
    val deleteEmployee: UserRow? = null,
)

@OptIn(ExperimentalCoroutinesApi::class)
class PersonViewModel(
    private val repos: Repositories,
    private val masters: MasterRepository,
    private val employees: EmployeeRepository,
    private val sessions: SessionManager,
    val level: Int,
    private val operator: String,
) : ViewModel() {

    private val local = MutableStateFlow(PersonUiState())
    val state: StateFlow<PersonUiState> = local

    val isAdmin: Boolean get() = level == 1
    val canFilterStaff: Boolean get() = level == 1 || level == 2

    val people: StateFlow<List<PersonRow>> = combine(repos.observePerson(), local) { rows, s ->
        PersonFeed.filterPeople(rows, s.tab, s.query)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val staff: StateFlow<List<UserRow>> = combine(repos.observeUser(), local) { rows, s ->
        PersonFeed.filterStaff(rows, s.levelFilter, s.statusFilter, s.query)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Riwayat nota person terpilih, urut terbaru seperti `sort: '-created_at'` web. */
    val history: StateFlow<List<MenuRow>> = local
        .map { it.detailPerson }
        .flatMapLatest { person ->
            if (person == null) flowOf(emptyList())
            else repos.observeMenu().map { rows ->
                PersonFeed.historyRows(rows.filter { it.person == person.idLama })
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val historySummary: StateFlow<PersonSummary> = history
        .map { PersonFeed.historySummary(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), PersonSummary.EMPTY)

    val gaji: StateFlow<List<GajiRow>> = local
        .map { it.detailEmployee }
        .flatMapLatest { user ->
            if (user == null || !isAdmin) flowOf(emptyList())
            else repos.observeGajiPerson(user.username).map { rows -> rows.sortedByDescending { it.createdAt } }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val bon: StateFlow<List<CashflowRow>> = local
        .map { it.detailEmployee }
        .flatMapLatest { user ->
            if (user == null) flowOf(emptyList())
            else repos.observeCashflow().map { rows ->
                PersonFeed.bonRows(rows, user.username.ifBlank { user.name })
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private var searchJob: Job? = null

    fun setSearchInput(value: String) {
        local.update { it.copy(searchInput = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(500)
            local.update { it.copy(query = value, page = 1) }
        }
    }

    fun setPerPage(value: Int) {
        if (local.value.perPage != value) local.update { it.copy(perPage = value) }
    }

    fun selectTab(tab: PersonTab) = local.update {
        it.copy(tab = tab, page = 1, searchInput = "", query = "")
    }

    fun setLevel(value: String) = local.update { it.copy(levelFilter = value, page = 1) }

    fun setStatus(value: String) = local.update { it.copy(statusFilter = value, page = 1) }

    fun setPage(value: Int) = local.update { it.copy(page = value.coerceAtLeast(1)) }

    fun clearMessage() = local.update { it.copy(message = null, error = null) }

    fun newPerson() {
        val jenis = if (local.value.tab == PersonTab.SUPPLIER) "Supplier" else "Customer"
        local.update {
            it.copy(
                personDraft = MasterDraft(
                    kategori = "Person",
                    jenis = jenis,
                    text9 = if (jenis == "Supplier") "Supplier" else "Pelanggan",
                    operator = operator,
                ),
                error = null,
            )
        }
    }

    fun editPerson(row: PersonRow) = local.update {
        it.copy(
            personDraft = MasterDraft(
                id = row.id,
                kategori = "Person",
                jenis = row.jenis,
                text1 = row.nama,
                text2 = row.keterangan,
                text3 = row.text3,
                text4 = row.text4,
                text5 = row.text5,
                text6 = row.text6,
                text7 = row.text7,
                text9 = row.text9.ifBlank { if (row.jenis.equals("Supplier", true)) "Supplier" else "Pelanggan" },
                number2 = row.number2.stripTrailingZeros().toPlainString(),
                number3 = row.number3.stripTrailingZeros().toPlainString(),
                number4 = row.number4.stripTrailingZeros().toPlainString(),
                phone = row.phone,
                visibilitas = row.visibilitas.ifBlank { "1,2,3,4,5,6,7" },
                idLama = row.idLama,
                linkImage = row.linkImage,
                operator = operator,
            ),
            detailPerson = null,
            error = null,
        )
    }

    fun newEmployee() = local.update { it.copy(employeeDraft = EmployeeDraft(), error = null) }

    fun editEmployee(row: UserRow) = local.update {
        it.copy(
            employeeDraft = EmployeeDraft(
                id = row.id,
                name = row.name,
                username = row.username,
                email = row.email,
                phone = row.phone,
                level = row.level,
                status = row.status.ifBlank { "active" },
                linkImage = row.linkImage,
                number = row.number1.stripTrailingZeros().toPlainString(),
                emailVisibility = row.emailVisibility,
                verified = row.verified,
            ),
            detailEmployee = null,
            error = null,
        )
    }

    fun showPerson(row: PersonRow) = local.update {
        it.copy(detailPerson = row, detailEmployee = null, detailTab = PersonDetailTab.PERSON_OVERVIEW, historyPage = 1)
    }

    fun showEmployee(row: UserRow) = local.update {
        it.copy(detailEmployee = row, detailPerson = null, detailTab = PersonDetailTab.USER_OVERVIEW, gajiPage = 1, bonPage = 1)
    }

    fun setDetailTab(tab: PersonDetailTab) = local.update { it.copy(detailTab = tab) }

    fun setHistoryPage(page: Int) = local.update { it.copy(historyPage = page.coerceAtLeast(1)) }

    fun setGajiPage(page: Int) = local.update { it.copy(gajiPage = page.coerceAtLeast(1)) }

    fun setBonPage(page: Int) = local.update { it.copy(bonPage = page.coerceAtLeast(1)) }

    fun showSlip(row: GajiRow) = local.update { it.copy(slip = row) }

    fun closeSlip() = local.update { it.copy(slip = null) }

    fun closeDetail() = local.update {
        it.copy(detailPerson = null, detailEmployee = null, slip = null)
    }

    fun closeForm() = local.update { it.copy(personDraft = null, employeeDraft = null, error = null) }

    fun updatePerson(block: (MasterDraft) -> MasterDraft) = local.update {
        it.copy(personDraft = it.personDraft?.let(block))
    }

    fun updateEmployee(block: (EmployeeDraft) -> EmployeeDraft) = local.update {
        it.copy(employeeDraft = it.employeeDraft?.let(block))
    }

    fun savePerson() {
        val draft = local.value.personDraft ?: return
        if (local.value.saving) return
        if (draft.text1.isBlank() || draft.jenis.isBlank()) {
            local.update { it.copy(error = "Nama dan Jenis Transaksi wajib diisi!") }
            return
        }
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = masters.save(draft.copy(kategori = "Person"))) {
                is MasterSave.Saved -> local.update {
                    it.copy(
                        saving = false,
                        personDraft = null,
                        page = 1,
                        message = if (result.created) "Data partner berhasil ditambahkan." else "Data partner berhasil diperbarui.",
                    )
                }
                is MasterSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun saveEmployee() {
        val draft = local.value.employeeDraft ?: return
        if (local.value.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = employees.save(draft)) {
                is EmployeeSave.Saved -> local.update {
                    it.copy(
                        saving = false,
                        employeeDraft = null,
                        page = 1,
                        message = if (result.created) {
                            "Karyawan baru berhasil ditambahkan (Password Default: password123)."
                        } else {
                            "Data karyawan berhasil diperbarui."
                        },
                    )
                }
                is EmployeeSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun askDeletePerson(row: PersonRow) = local.update { it.copy(deletePerson = row) }

    fun askDeleteEmployee(row: UserRow) = local.update { it.copy(deleteEmployee = row) }

    fun cancelDelete() = local.update { it.copy(deletePerson = null, deleteEmployee = null) }

    /**
     * Hapus lewat `permissions/delete` seperti `DeleteAccess` web. Pemeriksaan butuh
     * jaringan; offline ditolak supaya tombol tidak pernah menghapus buta.
     */
    fun confirmDelete() {
        val person = local.value.deletePerson
        val employee = local.value.deleteEmployee
        if (person == null && employee == null) return
        val collection = if (person != null) "dropdown" else "user"
        val id = person?.id ?: employee?.id.orEmpty()
        if (local.value.deleting) return
        local.update { it.copy(deleting = true) }
        viewModelScope.launch {
            val allowed = if (isAdmin) checkDeleteAccess(collection, id) else false
            if (!allowed) {
                local.update {
                    it.copy(
                        deleting = false,
                        deletePerson = null,
                        deleteEmployee = null,
                        message = "Penghapusan ditolak. Periksa koneksi dan hak akses.",
                    )
                }
                return@launch
            }
            val ok = if (person != null) masters.delete(person.id) else employees.delete(employee!!.id)
            local.update {
                it.copy(
                    deleting = false,
                    deletePerson = null,
                    deleteEmployee = null,
                    detailPerson = null,
                    detailEmployee = null,
                    message = when {
                        !ok -> "Data tidak ditemukan."
                        employee != null -> "User berhasil dihapus"
                        else -> "Data person berhasil dihapus."
                    },
                )
            }
        }
    }

    private suspend fun checkDeleteAccess(collection: String, id: String): Boolean = runCatching {
        val body = buildJsonObject {
            put(
                "records",
                kotlinx.serialization.json.buildJsonArray {
                    add(
                        buildJsonObject {
                            put("collection", collection)
                            put("id", id)
                        },
                    )
                },
            )
        }
        sessions.call("/api/permissions/delete", "POST", body).toString().contains("\"allowed\":true")
    }.getOrDefault(false)

    companion object {
        fun from(container: AppContainer): PersonViewModel {
            val user = container.tokenStore.cachedUser()
            return PersonViewModel(
                repos = container.repositories,
                masters = container.masterRepository,
                employees = container.employeeRepository,
                sessions = container.sessions,
                level = user?.level ?: 0,
                operator = user?.let { it.name.ifBlank { it.username } }.orEmpty().ifBlank { "Admin" },
            )
        }
    }
}
