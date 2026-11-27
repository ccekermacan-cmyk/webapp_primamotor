package id.primamotor.pos.ui.person

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.EmployeeDraft
import id.primamotor.pos.data.repo.EmployeeSave
import id.primamotor.pos.data.repo.EmployeeRepository
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.data.repo.MasterRepository
import id.primamotor.pos.data.repo.MasterSave
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.UserRow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class PersonTab(val label: String) {
    PEOPLE("People"),
    CUSTOMER("Customer"),
    SUPPLIER("Supplier"),
    KARYAWAN("Karyawan"),
}

data class PersonUiState(
    val tab: PersonTab = PersonTab.PEOPLE,
    val query: String = "",
    val levelFilter: String = "all",
    val statusFilter: String = "all",
    val personDraft: MasterDraft? = null,
    val employeeDraft: EmployeeDraft? = null,
    val detailPerson: PersonRow? = null,
    val detailEmployee: UserRow? = null,
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val deletePerson: PersonRow? = null,
    val deleteEmployee: UserRow? = null,
)

class PersonViewModel(
    private val repos: Repositories,
    private val masters: MasterRepository,
    private val employees: EmployeeRepository,
    private val operator: String,
    private val userLevel: Int,
) : ViewModel() {

    private val local = MutableStateFlow(PersonUiState())
    val state: StateFlow<PersonUiState> = local

    private val peopleFlow = repos.observePerson()
    private val employeeFlow = repos.observeUser()

    val people: StateFlow<List<PersonRow>> = combine(peopleFlow, local) { rows, state ->
        val query = state.query.trim().lowercase()
        rows.filter { row ->
            (state.tab == PersonTab.PEOPLE ||
                (state.tab == PersonTab.CUSTOMER && row.jenis.equals("Customer", true)) ||
                (state.tab == PersonTab.SUPPLIER && row.jenis.equals("Supplier", true))) &&
                (query.isBlank() || row.nama.lowercase().contains(query) ||
                    row.idLama.lowercase().contains(query) || row.phone.contains(query) ||
                    row.keterangan.lowercase().contains(query))
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val staff: StateFlow<List<UserRow>> = combine(employeeFlow, local) { rows, state ->
        val query = state.query.trim().lowercase()
        rows.filter { row ->
            (state.levelFilter == "all" || row.level.toString() == state.levelFilter) &&
                (state.statusFilter == "all" || row.status.equals(state.statusFilter, true)) &&
                (query.isBlank() || row.name.lowercase().contains(query) || row.username.lowercase().contains(query))
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val isAdmin: Boolean = userLevel == 1

    fun selectTab(tab: PersonTab) = local.update { it.copy(tab = tab, query = "") }

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun setLevel(value: String) = local.update { it.copy(levelFilter = value) }

    fun setStatus(value: String) = local.update { it.copy(statusFilter = value) }

    fun clearMessage() = local.update { it.copy(message = null, error = null) }

    fun newPerson() {
        val jenis = when (local.value.tab) {
            PersonTab.SUPPLIER -> "Supplier"
            else -> "Customer"
        }
        local.update {
            it.copy(
                personDraft = MasterDraft(kategori = "Person", jenis = jenis, operator = operator),
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
                alamat = row.alamat,
                phone = row.phone,
                number1 = row.number1.stripTrailingZeros().toPlainString(),
                number2 = row.number2.stripTrailingZeros().toPlainString(),
                visibilitas = row.visibilitas.ifBlank { "1,2,3,4,5,6,7" },
                idLama = row.idLama,
                operator = operator,
            ),
            detailPerson = null,
            error = null,
        )
    }

    fun newEmployee() = local.update {
        it.copy(
            employeeDraft = EmployeeDraft(),
            error = null,
        )
    }

    fun editEmployee(row: UserRow) = local.update {
        it.copy(
            employeeDraft = EmployeeDraft(
                id = row.id,
                name = row.name,
                username = row.username,
                email = row.email,
                phone = row.phone,
                level = row.level,
                status = row.status,
                linkImage = row.linkImage,
            ),
            detailEmployee = null,
            error = null,
        )
    }

    fun showPerson(row: PersonRow) = local.update { it.copy(detailPerson = row) }

    fun showEmployee(row: UserRow) = local.update { it.copy(detailEmployee = row) }

    fun closeDetail() = local.update { it.copy(detailPerson = null, detailEmployee = null) }

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
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = masters.save(draft)) {
                is MasterSave.Saved -> local.update {
                    it.copy(
                        saving = false,
                        personDraft = null,
                        message = if (result.created) "Data pihak berhasil ditambahkan." else "Data pihak berhasil diperbarui.",
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

    fun confirmDelete() {
        val person = local.value.deletePerson
        val employee = local.value.deleteEmployee
        local.update { it.copy(deletePerson = null, deleteEmployee = null, error = null) }
        viewModelScope.launch {
            val ok = when {
                person != null -> masters.delete(person.id)
                employee != null -> employees.delete(employee.id)
                else -> false
            }
            local.update {
                it.copy(
                    detailPerson = null,
                    detailEmployee = null,
                    message = if (ok) "Penghapusan masuk antrean. Server menolak jika hak akses tidak cukup." else "Data tidak ditemukan.",
                )
            }
        }
    }
}
