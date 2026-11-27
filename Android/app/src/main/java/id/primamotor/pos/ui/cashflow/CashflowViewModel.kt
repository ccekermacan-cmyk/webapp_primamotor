package id.primamotor.pos.ui.cashflow

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.repo.BonDraft
import id.primamotor.pos.data.repo.BonRow
import id.primamotor.pos.data.repo.CashDraft
import id.primamotor.pos.data.repo.CashSave
import id.primamotor.pos.data.repo.CashflowRepository
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.domain.CashflowFeed
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.WibDate
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.time.LocalDate

data class CashAlert(
    val title: String,
    val message: String,
    val confirmLabel: String = "SAYA MENGERTI",
    val action: CashAction? = null,
)

enum class CashAction { DELETE_CASH, DELETE_BON, DISCARD_FORM, CHANGE_MUTASI }

data class HistoryPage(
    val groups: List<Pair<String, List<CashflowRow>>> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pages: Int = 1,
)

data class TempoPage(
    val days: List<CashflowFeed.TempoDay> = emptyList(),
    val page: Int = 1,
    val pages: Int = 1,
    val total: Int = 0,
    val totalAll: Int = 0,
    val pageTotal: BigDecimal = BigDecimal.ZERO,
    val overdueCount: Int = 0,
    val overdueRest: BigDecimal = BigDecimal.ZERO,
    val upcomingCount: Int = 0,
    val upcomingRest: BigDecimal = BigDecimal.ZERO,
    val grandRest: BigDecimal = BigDecimal.ZERO,
)

class CashflowViewModel(
    private val repos: Repositories,
    private val writer: CashflowRepository,
    private val sessions: SessionManager,
    val level: Int,
    val operator: String,
) : ViewModel() {

    val showTempo: Boolean get() = level in setOf(1, 2, 5, 6)
    val showSaldo: Boolean get() = level in setOf(1, 2, 5)

    private val local = MutableStateFlow(
        CashflowUiState(
            level = level,
            activeTab = "history",
            formData = CashDraft(createdAtIso = nowInput()),
            formDataBon = BonDraft(createdAtIso = nowInput()),
        ),
    )
    val state: StateFlow<CashflowUiState> = local

    private val accounts: StateFlow<List<PersonRow>> = repos.observeAccounts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private val people: StateFlow<List<PersonRow>> = repos.observePerson()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private val users: StateFlow<List<UserRow>> = repos.observeUser()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private val kinds: StateFlow<List<id.primamotor.pos.data.repo.CashflowKind>> = repos.observeCashflowJenis()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private val allRows: StateFlow<List<CashflowRow>> = repos.observeCashflow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private val menus: StateFlow<List<MenuRow>> = repos.observeMenu()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val wallets: StateFlow<List<CashflowFeed.Wallet>> =
        combine(accounts, people, users) { a, p, u -> CashflowFeed.wallets(a, p, u) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Akun siap pakai di form: hanya dompet kas, bukan piutang/hutang. */
    val accountOptions: StateFlow<List<CashflowFeed.Wallet>> = wallets
        .combine(local) { list, _ -> list.filter { it.kind == CashflowFeed.WalletKind.KAS } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val kindOptions: StateFlow<List<id.primamotor.pos.data.repo.CashflowKind>> = kinds

    val employees: StateFlow<List<CashflowFeed.Wallet>> = wallets
        .combine(local) { list, _ -> list.filter { it.kind == CashflowFeed.WalletKind.KARYAWAN } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val customers: StateFlow<List<CashflowFeed.Wallet>> = wallets
        .combine(local) { list, _ ->
            list.filter { it.kind == CashflowFeed.WalletKind.CUSTOMER || it.kind == CashflowFeed.WalletKind.KARYAWAN }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val history: StateFlow<HistoryPage> = combine(allRows, local) { rows, s ->
        val filtered = CashflowFeed.apply(rows, s.filter)
        val pages = maxOf(1, (filtered.size + CashflowFeed.PER_PAGE - 1) / CashflowFeed.PER_PAGE)
        val page = s.page.coerceIn(1, pages)
        val slice = filtered.drop((page - 1) * CashflowFeed.PER_PAGE).take(CashflowFeed.PER_PAGE)
        HistoryPage(CashflowFeed.groupByDate(slice), filtered.size, page, pages)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HistoryPage())

    val tempo: StateFlow<TempoPage> = combine(menus, local) { rows, s ->
        val days = CashflowFeed.tempo(rows)
        val filtered = when (s.tempoFilter) {
            "overdue" -> days.filter { it.overdue }
            "upcoming" -> days.filter { !it.overdue }
            else -> days
        }
        val items = filtered.flatMap { it.items }
        val pages = maxOf(1, (items.size + CashflowFeed.TEMPO_PER_PAGE - 1) / CashflowFeed.TEMPO_PER_PAGE)
        val page = s.tempoPage.coerceIn(1, pages)
        val slice = items.drop((page - 1) * CashflowFeed.TEMPO_PER_PAGE).take(CashflowFeed.TEMPO_PER_PAGE)
        val pageKeys = slice.map { it.tempo.take(10) }.toSet()
        var overdueCount = 0
        var overdueRest = BigDecimal.ZERO
        var upcomingCount = 0
        var upcomingRest = BigDecimal.ZERO
        var grandRest = BigDecimal.ZERO
        days.flatMap { day -> day.items.map { day to it } }.forEach { (day, row) ->
            val rest = CashflowFeed.remaining(row)
            grandRest += rest
            if (day.overdue) {
                overdueCount += 1
                overdueRest += rest
            } else {
                upcomingCount += 1
                upcomingRest += rest
            }
        }
        TempoPage(
            days = filtered.filter { it.key in pageKeys },
            page = page,
            pages = pages,
            total = items.size,
            totalAll = days.sumOf { it.items.size },
            pageTotal = slice.fold(BigDecimal.ZERO) { sum, row -> sum + CashflowFeed.remaining(row) },
            overdueCount = overdueCount,
            overdueRest = overdueRest,
            upcomingCount = upcomingCount,
            upcomingRest = upcomingRest,
            grandRest = grandRest,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TempoPage())

    val detail: StateFlow<CashflowRow?> = combine(allRows, local) { rows, s ->
        s.selectedId?.let { id -> rows.firstOrNull { it.id == id } }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    init {
        // Tombol Bon di web hanya muncul bila dropdown punya penanda `addbon`.
        viewModelScope.launch {
            repos.observeFlag("dropdown", "addbon").collect { has ->
                local.update { it.copy(configBon = has) }
            }
        }
    }

    private val bonRows = MutableStateFlow<List<BonRow>>(emptyList())
    val bonHistory: StateFlow<List<BonRow>> = bonRows
    private var bonJob: Job? = null
    private var searchJob: Job? = null

    fun setTab(tab: String) = local.update {
        it.copy(activeTab = tab, page = if (tab == "history") 1 else it.page)
    }

    fun setAccountTab(tab: CashflowFeed.WalletKind) = local.update {
        it.copy(activeAccountTab = tab, showZeroBalances = false)
    }

    fun toggleZeroBalances() = local.update { it.copy(showZeroBalances = !it.showZeroBalances) }

    fun setMutasi(value: String) = local.update {
        it.copy(filter = it.filter.copy(mutasi = value, jenisKeys = if (value == it.filter.mutasi) it.filter.jenisKeys else emptySet()), page = 1)
    }

    fun toggleAccount(id: String) = local.update {
        val ids = if (id in it.filter.accountIds) it.filter.accountIds - id else it.filter.accountIds + id
        it.copy(filter = it.filter.copy(accountIds = ids), page = 1)
    }

    fun filterByAccount(id: String) = local.update {
        it.copy(activeTab = "history", filter = it.filter.copy(accountIds = setOf(id)), page = 1)
    }

    fun toggleJenis(key: String) = local.update {
        val keys = if (key in it.filter.jenisKeys) it.filter.jenisKeys - key else it.filter.jenisKeys + key
        it.copy(filter = it.filter.copy(jenisKeys = keys), page = 1)
    }

    fun setDates(from: String, to: String) = local.update {
        it.copy(filter = it.filter.copy(from = from, to = to), page = 1)
    }

    fun applyDatePreset(days: Int) {
        val today = LocalDate.now(WibDate.WIB)
        setDates(today.minusDays(days.toLong()).toString(), today.toString())
    }

    fun clearDates() = local.update { it.copy(filter = it.filter.copy(from = "", to = ""), page = 1) }

    /** Input cari di-debounce 250 ms seperti web. */
    fun setSearch(value: String) {
        local.update { it.copy(searchInput = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(250)
            local.update { it.copy(filter = it.filter.copy(search = value), page = 1) }
        }
    }

    fun clearSearch() {
        searchJob?.cancel()
        local.update { it.copy(searchInput = "", filter = it.filter.copy(search = ""), page = 1) }
    }

    fun setPage(page: Int) = local.update { it.copy(page = page.coerceAtLeast(1)) }

    fun setTempoFilter(value: String) = local.update { it.copy(tempoFilter = value, tempoPage = 1) }

    fun setTempoPage(page: Int) = local.update { it.copy(tempoPage = page.coerceAtLeast(1)) }

    fun dismissAlert() = local.update { it.copy(alert = null) }

    fun clearError() = local.update { it.copy(error = null) }

    // ---- Detail -----------------------------------------------------------

    fun openDetail(row: CashflowRow) {
        local.update { it.copy(selectedId = row.id, error = null, canDeleteSelected = false) }
        checkDeleteAccess("cashflow", row.id) { allowed ->
            local.update { if (it.selectedId == row.id) it.copy(canDeleteSelected = allowed) else it }
        }
    }

    fun closeDetail() = local.update { it.copy(selectedId = null) }

    // ---- Form kas ---------------------------------------------------------

    fun openCashForm(row: CashflowRow? = null) = local.update {
        it.copy(
            modalType = "form",
            selectedId = row?.id,
            error = null,
            formData = row?.let(::draftOf) ?: CashDraft(createdAtIso = nowInput()),
        )
    }

    fun openBonForm() = local.update {
        it.copy(
            modalType = "formBon",
            error = null,
            formDataBon = BonDraft(createdAtIso = nowInput(), catatCashflow = it.configBon.not()),
        )
    }

    fun closeForm() = local.update {
        if (isDirty(it) && it.alert == null) {
            it.copy(
                alert = CashAlert(
                    "Tutup Form?",
                    "Ada perubahan yang belum disimpan. Yakin ingin menutup?",
                    confirmLabel = "Ya, Lanjutkan",
                    action = CashAction.DISCARD_FORM,
                ),
            )
        } else {
            it.copy(modalType = null, selectedId = null, error = null)
        }
    }

    fun forceCloseForm() = local.update { it.copy(modalType = null, selectedId = null, error = null) }

    fun updateCash(block: (CashDraft) -> CashDraft) = local.update { it.copy(formData = block(it.formData)) }

    fun updateBon(block: (BonDraft) -> BonDraft) = local.update { it.copy(formDataBon = block(it.formDataBon)) }

    /** Ganti arah mutasi mereset jenis, seperti konfirmasi web. */
    fun changeMutasi(value: String) = local.update {
        if (it.formData.jenis.isBlank() || it.formData.mutasi == value) {
            it.copy(formData = it.formData.copy(mutasi = value, jenis = it.formData.jenis))
        } else {
            it.copy(
                alert = CashAlert(
                    "Ubah Jenis Mutasi?",
                    "Mengubah jenis mutasi akan mereset pilihan Jenis Cashflow. Lanjutkan?",
                    confirmLabel = "Ya, Lanjutkan",
                    action = CashAction.CHANGE_MUTASI,
                ),
                pendingMutasi = value,
            )
        }
    }

    fun confirmAction() {
        val alert = local.value.alert ?: return
        local.update { it.copy(alert = null) }
        when (alert.action) {
            CashAction.DELETE_CASH -> confirmDeleteCash()
            CashAction.DELETE_BON -> confirmDeleteBon()
            CashAction.DISCARD_FORM -> forceCloseForm()
            CashAction.CHANGE_MUTASI -> local.update {
                it.copy(formData = it.formData.copy(mutasi = it.pendingMutasi, jenis = "", account2Id = ""), pendingMutasi = "")
            }
            null -> Unit
        }
    }

    fun saveCash() {
        val snapshot = local.value
        if (snapshot.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = writer.save(snapshot.formData, operator)) {
                is CashSave.Saved -> local.update {
                    it.copy(saving = false, modalType = null, selectedId = null, formData = CashDraft(createdAtIso = nowInput()))
                }
                is CashSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun saveBon() {
        val snapshot = local.value
        if (snapshot.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = writer.catatBon(snapshot.formDataBon, operator)) {
                is CashSave.Saved -> local.update {
                    it.copy(
                        saving = false,
                        modalType = null,
                        formDataBon = BonDraft(createdAtIso = nowInput()),
                        alert = CashAlert("Sukses", "Data Bon berhasil disimpan!"),
                    )
                }
                is CashSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    // ---- Hapus ------------------------------------------------------------

    fun askDeleteCash(row: CashflowRow) {
        local.update {
            it.copy(
                alert = CashAlert(
                    "Hapus Transaksi?",
                    "Yakin ingin menghapus transaksi kas ini secara permanen?",
                    confirmLabel = "Ya, Lanjutkan",
                    action = CashAction.DELETE_CASH,
                ),
                deleteRow = row,
            )
        }
    }

    private fun confirmDeleteCash() {
        val row = local.value.deleteRow ?: return
        viewModelScope.launch {
            val ok = writer.deleteCashflow(row.id)
            local.update {
                it.copy(
                    deleteRow = null,
                    selectedId = null,
                    error = if (ok) null else "Terjadi kesalahan saat menghapus data.",
                )
            }
        }
    }

    fun askDeleteBon(row: BonRow) {
        local.update {
            it.copy(
                alert = CashAlert(
                    "Hapus Riwayat Bon?",
                    "Aksi ini akan mengembalikan (revert) saldo bon karyawan sesuai dengan nominal riwayat ini. Apakah Anda yakin?",
                    confirmLabel = "Ya, Lanjutkan",
                    action = CashAction.DELETE_BON,
                ),
                deleteBonRow = row,
            )
        }
    }

    private fun confirmDeleteBon() {
        val row = local.value.deleteBonRow ?: return
        viewModelScope.launch {
            when (val result = writer.deleteBon(row.id)) {
                is CashSave.Saved -> local.update {
                    it.copy(deleteBonRow = null, alert = CashAlert("Berhasil", "Riwayat Bon dihapus dan saldo di-revert."))
                }
                is CashSave.Rejected -> local.update {
                    it.copy(deleteBonRow = null, alert = CashAlert("Gagal", result.message))
                }
            }
        }
    }

    // ---- Riwayat bon ------------------------------------------------------

    fun openBonHistory(wallet: CashflowFeed.Wallet) {
        local.update { it.copy(bonHistoryWallet = wallet, canDeleteBonHistory = false) }
        bonJob?.cancel()
        bonJob = viewModelScope.launch { repos.observeBon(wallet.id).collect { bonRows.value = it } }
        if (level == 1) {
            checkDeleteAccess("bon", null) { allowed -> local.update { it.copy(canDeleteBonHistory = allowed) } }
        }
    }

    fun closeBonHistory() {
        bonJob?.cancel()
        bonJob = null
        bonRows.value = emptyList()
        local.update { it.copy(bonHistoryWallet = null) }
    }

    // ---- Hitung ulang -----------------------------------------------------

    /**
     * Hanya untuk piutang/hutang dan butuh server (`recalculate_person` dihitung hook).
     * Offline: tombol tidak melakukan apa pun kecuali memberi pesan.
     */
    fun recalculate() {
        val tab = local.value.activeAccountTab
        if (tab != CashflowFeed.WalletKind.CUSTOMER && tab != CashflowFeed.WalletKind.SUPPLIER) {
            local.update { it.copy(alert = CashAlert("Info", "Fitur hitung ulang hanya untuk tab Piutang dan Hutang.")) }
            return
        }
        val targets = wallets.value.filter { it.kind == tab }
        if (targets.isEmpty()) {
            local.update { it.copy(alert = CashAlert("Info", "Tidak ada data untuk kategori ini.")) }
            return
        }
        if (local.value.calculating) return
        local.update { it.copy(calculating = true) }
        viewModelScope.launch {
            val ok = runCatching {
                targets.forEach { wallet ->
                    val body = buildJsonObject {
                        put("recalculate_person", true)
                        put("text_8", LocalDate.now(WibDate.WIB).toString())
                    }
                    sessions.call("/api/collections/dropdown/records/${wallet.id}", "PATCH", body)
                }
            }.isSuccess
            local.update {
                it.copy(
                    calculating = false,
                    alert = if (ok) {
                        CashAlert("Sukses", "Berhasil menghitung ulang & memperbarui ${targets.size} data!")
                    } else {
                        CashAlert("Gagal", "Terjadi kesalahan saat menghitung. Periksa koneksi lalu coba lagi.")
                    },
                )
            }
        }
    }

    // ---- Util -------------------------------------------------------------

    private fun isDirty(state: CashflowUiState): Boolean = when (state.modalType) {
        "form" -> state.formData.let {
            it.jenis.isNotBlank() || it.accountId.isNotBlank() || it.nominal.signum() != 0 || it.note.isNotBlank()
        }
        "formBon" -> state.formDataBon.let {
            it.personText.isNotBlank() || it.nominal.signum() != 0 || it.note.isNotBlank()
        }
        else -> false
    }

    private fun checkDeleteAccess(collection: String, id: String?, callback: (Boolean) -> Unit) {
        viewModelScope.launch {
            val allowed = runCatching {
                val body = buildJsonObject {
                    put(
                        "records",
                        buildJsonArray {
                            add(
                                buildJsonObject {
                                    put("collection", collection)
                                    put("id", id.orEmpty())
                                },
                            )
                        },
                    )
                }
                sessions.call("/api/permissions/delete", "POST", body).toString().contains("\"allowed\":true")
            }.getOrDefault(false)
            callback(allowed)
        }
    }

    private fun draftOf(row: CashflowRow): CashDraft = CashDraft(
        id = row.id,
        createdAtIso = localInput(row.createdAt),
        mutasi = if (CashflowFeed.isMasuk(row)) "Masuk" else "Keluar",
        jenis = row.jenis,
        accountId = row.account1,
        account2Id = row.account2.takeIf { CashflowFeed.isTransfer(row) }.orEmpty(),
        personId = row.person,
        personText = row.persontext,
        nominal = row.nominal,
        note = row.note,
    )

    companion object {
        /** `datetime-local` tanpa zona, seperti input web. */
        fun nowInput(): String = WibDate.parseInstant(WibDate.nowIso())!!
            .atZone(WibDate.WIB).toLocalDateTime().toString().take(16)

        fun localInput(raw: String): String =
            WibDate.parseInstant(raw)?.atZone(WibDate.WIB)?.toLocalDateTime()?.toString()?.take(16) ?: nowInput()

        fun rupiah(value: BigDecimal?): String =
            if (value == null) "Belum tersedia" else Money.formatRupiah(value)

        fun from(container: AppContainer): CashflowViewModel {
            val user = container.tokenStore.cachedUser()
            return CashflowViewModel(
                repos = container.repositories,
                writer = container.cashflowRepository,
                sessions = container.sessions,
                level = user?.level ?: 0,
                operator = user?.let { it.name.ifBlank { it.username } }.orEmpty().ifBlank { "Admin" },
            )
        }
    }
}

data class CashflowUiState(
    val level: Int = 0,
    val activeTab: String = "history",
    val activeAccountTab: CashflowFeed.WalletKind = CashflowFeed.WalletKind.KAS,
    val filter: CashflowFeed.HistoryFilter = CashflowFeed.HistoryFilter(),
    val searchInput: String = "",
    val page: Int = 1,
    val showZeroBalances: Boolean = false,
    val modalType: String? = null,
    val selectedId: String? = null,
    val formData: CashDraft = CashDraft(),
    val formDataBon: BonDraft = BonDraft(),
    val pendingMutasi: String = "",
    val saving: Boolean = false,
    val calculating: Boolean = false,
    val error: String? = null,
    val alert: CashAlert? = null,
    val deleteRow: CashflowRow? = null,
    val deleteBonRow: BonRow? = null,
    val bonHistoryWallet: CashflowFeed.Wallet? = null,
    val canDeleteSelected: Boolean = false,
    val canDeleteBonHistory: Boolean = false,
    val tempoFilter: String = "all",
    val tempoPage: Int = 1,
    val configBon: Boolean = false,
)
