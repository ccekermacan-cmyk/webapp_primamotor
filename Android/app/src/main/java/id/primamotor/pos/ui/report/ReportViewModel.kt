package id.primamotor.pos.ui.report

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.ReportRepository
import id.primamotor.pos.data.repo.ReportRow
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.number
import id.primamotor.pos.data.repo.object_
import id.primamotor.pos.data.repo.text
import id.primamotor.pos.data.repo.toReportLog
import id.primamotor.pos.data.repo.toReportOngkos
import id.primamotor.pos.domain.CashStats
import id.primamotor.pos.domain.ChartPoint
import id.primamotor.pos.domain.LogStats
import id.primamotor.pos.domain.MenuStats
import id.primamotor.pos.domain.OngkosStats
import id.primamotor.pos.domain.ReportDetailTab
import id.primamotor.pos.domain.ReportFeed
import id.primamotor.pos.domain.ReportLog
import id.primamotor.pos.domain.ReportOngkos
import id.primamotor.pos.domain.ReportSummary
import id.primamotor.pos.domain.WibDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

/** Metrik grafik tren, label dan warna sama seperti checkbox web. */
enum class ReportMetric(val label: String, val color: Long) {
    OMSET("Omset", 0xFF3B82F6),
    PENGELUARAN("Pengeluaran", 0xFFF43F5E),
    LABA("Laba", 0xFF10B981),
    PIUTANG("Piutang", 0xFFF59E0B),
    HUTANG("Hutang", 0xFF8B5CF6),
}

data class ReportUiState(
    val queryInput: String = "",
    val query: String = "",
    val from: String = "",
    val to: String = "",
    val page: Int = 1,
    val perPage: Int = 31,
    val metrics: Set<ReportMetric> = setOf(
        ReportMetric.OMSET,
        ReportMetric.PENGELUARAN,
        ReportMetric.PIUTANG,
        ReportMetric.HUTANG,
    ),
    val generateOpen: Boolean = false,
    val generateDate: String = "",
    val detail: ReportRow? = null,
    val detailTab: ReportDetailTab = ReportDetailTab.OVERVIEW,
    val detailSearch: String = "",
    val menuJenis: Set<String> = setOf("semua"),
    val menuStatus: String = "semua",
    val menuJenisOpen: Boolean = false,
    val logRef: String = "",
    val logDirection: String = "semua",
    val cashMutasi: String = "semua",
    val cashAccount: String = "semua",
    val cashJenis: String = "semua",
    val menuSort: Pair<String, Boolean> = "created_at" to false,
    val logSort: Pair<String, Boolean> = "created_at" to false,
    val cashSort: Pair<String, Boolean> = "created_at" to false,
    val busy: Boolean = false,
    val fixing: Boolean = false,
    val askDelete: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

/** Isi tab detail satu hari, dihitung sekali dari cache lalu dipakai layar. */
data class ReportDetailView(
    val menus: List<MenuRow> = emptyList(),
    val menuJenis: List<String> = emptyList(),
    val menuStats: MenuStats = MenuStats(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO),
    val menusById: Map<String, MenuRow> = emptyMap(),
    val logs: List<ReportLog> = emptyList(),
    val logStats: LogStats = LogStats(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO),
    val cash: List<CashflowRow> = emptyList(),
    val cashStats: CashStats = CashStats(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO),
    val cashAccounts: List<String> = emptyList(),
    val cashJenis: List<String> = emptyList(),
    val ongkos: List<ReportOngkos> = emptyList(),
    val ongkosStats: OngkosStats = OngkosStats(0, BigDecimal.ZERO, emptyList()),
)

@OptIn(ExperimentalCoroutinesApi::class)
class ReportViewModel(
    private val repos: Repositories,
    private val reports: ReportRepository,
    private val sessions: SessionManager,
    val level: Int,
    private val operator: String,
) : ViewModel() {

    private val local = MutableStateFlow(ReportUiState())
    val state: StateFlow<ReportUiState> = local

    val isAdmin: Boolean get() = level == 1
    val canDelete: Boolean get() = level in 1..5

    private val allReports: StateFlow<List<ReportRow>> = reports.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val filtered: StateFlow<List<ReportRow>> = combine(allReports, local) { rows, s ->
        ReportFeed.filterRows(rows, s.query, s.from, s.to)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val pageRows: StateFlow<List<ReportRow>> = combine(filtered, local) { rows, s ->
        ReportFeed.pageOf(rows, s.page, s.perPage)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val totalPages: StateFlow<Int> = combine(filtered, local) { rows, s ->
        ReportFeed.pagesOf(rows.size, s.perPage)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 1)

    val summary: StateFlow<ReportSummary> = pageRows
        .map { ReportFeed.summary(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ReportSummary.EMPTY)

    val chart: StateFlow<List<ChartPoint>> = pageRows
        .map { ReportFeed.chartPoints(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private data class RawDay(
        val menus: List<MenuRow>,
        val cash: List<CashflowRow>,
        val logs: List<ReportLog>,
        val ongkos: List<ReportOngkos>,
    )

    private val rawDay = combine(
        repos.observeMenu(),
        repos.observeCashflow(),
        repos.observeRaw("log_stock"),
        repos.observeRaw("ongkos"),
    ) { menus, cash, logs, ongkos ->
        RawDay(
            menus = menus,
            cash = cash,
            logs = logs.mapNotNull { it.toReportLog() },
            ongkos = ongkos.mapNotNull { it.toReportOngkos() },
        )
    }

    val detailView: StateFlow<ReportDetailView> = combine(
        rawDay,
        repos.observeProduk(),
        local,
    ) { raw, produk, s ->
        val day = s.detail?.let { ReportFeed.dayOf(it.createdAt) }.orEmpty()
        if (day.isBlank()) return@combine ReportDetailView()
        val productNames = produk.associate { it.id to ReportFeed.productName(it) }
        val allMenus = raw.menus.filter { ReportFeed.dayOf(it.createdAt) == day }
        val logs = ReportFeed.logLines(
            rows = raw.logs,
            day = day,
            query = s.detailSearch,
            productNames = productNames,
            ref = s.logRef,
            direction = s.logDirection,
            sortKey = s.logSort.first,
            asc = s.logSort.second,
        )
        val menus = ReportFeed.menuLines(
            rows = raw.menus,
            day = day,
            query = s.detailSearch,
            status = s.menuStatus,
            jenis = s.menuJenis,
            sortKey = s.menuSort.first,
            asc = s.menuSort.second,
        )
        val cash = ReportFeed.cashLines(
            rows = raw.cash,
            day = day,
            query = s.detailSearch,
            mutasi = s.cashMutasi,
            account = s.cashAccount,
            jenis = s.cashJenis,
            sortKey = s.cashSort.first,
            asc = s.cashSort.second,
        )
        val ongkos = ReportFeed.ongkosLines(raw.ongkos, day, s.detailSearch)
        ReportDetailView(
            menus = menus,
            menuJenis = ReportFeed.menuJenis(raw.menus, day, s.detailSearch, s.menuStatus),
            menuStats = ReportFeed.menuStats(menus),
            menusById = allMenus.associateBy { it.id },
            logs = logs,
            logStats = ReportFeed.logStats(logs, allMenus),
            cash = cash,
            cashStats = ReportFeed.cashStats(cash),
            cashAccounts = ReportFeed.cashAccounts(raw.cash, day, s.cashJenis, s.cashMutasi),
            cashJenis = ReportFeed.cashJenis(raw.cash, day, s.cashAccount, s.cashMutasi),
            ongkos = ongkos,
            ongkosStats = ReportFeed.ongkosStats(ongkos),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ReportDetailView())

    val today: String get() = WibDate.dayOf(WibDate.nowIso())?.toString().orEmpty()

    private var searchJob: Job? = null

    fun setQueryInput(value: String) {
        local.update { it.copy(queryInput = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(500)
            local.update { it.copy(query = value, page = 1) }
        }
    }

    fun setFrom(value: String) = local.update { it.copy(from = value, page = 1) }

    fun setTo(value: String) = local.update { it.copy(to = value, page = 1) }

    fun resetFilter() = local.update {
        it.copy(queryInput = "", query = "", from = "", to = "", page = 1)
    }

    fun setPage(value: Int) = local.update { it.copy(page = value.coerceAtLeast(1)) }

    fun toggleMetric(metric: ReportMetric) = local.update {
        val next = it.metrics.toMutableSet()
        if (!next.remove(metric)) next.add(metric)
        it.copy(metrics = next)
    }

    fun openGenerate() = local.update { it.copy(generateOpen = true, generateDate = "") }

    fun closeGenerate() = local.update { it.copy(generateOpen = false) }

    fun setGenerateDate(value: String) = local.update { it.copy(generateDate = value) }

    fun generate() {
        if (local.value.busy) return
        val target = local.value.generateDate.trim().ifBlank { today }
        local.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            val result = runCatching { reports.recalculate(target) }
            if (result.isSuccess) reports.pullDay(target)
            local.update {
                it.copy(
                    busy = false,
                    generateOpen = false,
                    message = result.fold(
                        onSuccess = { "Laporan berhasil direkalkulasi!" },
                        onFailure = { null },
                    ),
                    error = result.exceptionOrNull()?.let { error ->
                        error.message ?: "Perhitungan laporan belum berhasil."
                    },
                )
            }
        }
    }

    /** Buka detail satu tanggal, tarik harinya dari server bila online, cache tetap dipakai. */
    fun openDetail(row: ReportRow) {
        local.update {
            it.copy(
                detail = row,
                detailTab = ReportDetailTab.OVERVIEW,
                detailSearch = "",
                menuJenis = setOf("semua"),
                menuStatus = "semua",
                logRef = "",
                logDirection = "semua",
                cashMutasi = "semua",
                cashAccount = "semua",
                cashJenis = "semua",
                menuSort = "created_at" to false,
                logSort = "created_at" to false,
                cashSort = "created_at" to false,
            )
        }
        viewModelScope.launch { reports.pullDay(ReportFeed.dayOf(row.createdAt)) }
    }

    fun refreshDetail() {
        val row = local.value.detail ?: return
        viewModelScope.launch { reports.pullDay(ReportFeed.dayOf(row.createdAt)) }
    }

    fun closeDetail() = local.update { it.copy(detail = null, askDelete = false) }

    fun setDetailTab(tab: ReportDetailTab) = local.update { it.copy(detailTab = tab, detailSearch = "") }

    fun setDetailSearch(value: String) = local.update { it.copy(detailSearch = value) }

    fun toggleMenuJenisOpen() = local.update { it.copy(menuJenisOpen = !it.menuJenisOpen) }

    fun selectAllMenuJenis() = local.update { it.copy(menuJenis = setOf("semua")) }

    fun toggleMenuJenis(value: String) = local.update {
        val next = it.menuJenis.filter { item -> item != "semua" }.toMutableSet()
        if (!next.remove(value)) next.add(value)
        it.copy(menuJenis = if (next.isEmpty()) setOf("semua") else next)
    }

    fun setMenuStatus(value: String) = local.update { it.copy(menuStatus = value) }

    fun setLogRef(value: String) = local.update { it.copy(logRef = value) }

    fun setLogDirection(value: String) = local.update { it.copy(logDirection = value, logRef = "") }

    fun setCashMutasi(value: String) = local.update { it.copy(cashMutasi = value) }

    fun setCashAccount(value: String) = local.update { it.copy(cashAccount = value) }

    fun setCashJenis(value: String) = local.update { it.copy(cashJenis = value) }

    fun sortMenu(key: String) = local.update { it.copy(menuSort = toggle(it.menuSort, key)) }

    fun sortLog(key: String) = local.update { it.copy(logSort = toggle(it.logSort, key)) }

    fun sortCash(key: String) = local.update { it.copy(cashSort = toggle(it.cashSort, key)) }

    private fun toggle(current: Pair<String, Boolean>, key: String): Pair<String, Boolean> =
        if (current.first == key) key to !current.second else key to true

    fun openMenuLog(menuId: String) = local.update {
        it.copy(detailTab = ReportDetailTab.LOG, detailSearch = "", logRef = menuId, logDirection = "semua")
    }

    fun fixHargaBeli() {
        val row = local.value.detail ?: return
        if (!isAdmin || local.value.fixing) return
        val day = ReportFeed.dayOf(row.createdAt)
        local.update { it.copy(fixing = true) }
        viewModelScope.launch {
            val count = runCatching { reports.fixHargaBeli(day) }.getOrDefault(0)
            reports.pullDay(day)
            local.update {
                it.copy(
                    fixing = false,
                    message = "Penyesuaian selesai! $count baris berhasil diperbarui.",
                )
            }
        }
    }

    fun askDelete() = local.update { it.copy(askDelete = true) }

    fun cancelDelete() = local.update { it.copy(askDelete = false) }

    fun confirmDelete() {
        val row = local.value.detail ?: return
        if (!canDelete) return
        viewModelScope.launch {
            val ok = runCatching { reports.delete(row.id) }.getOrDefault(false)
            local.update {
                it.copy(
                    askDelete = false,
                    detail = if (ok) null else it.detail,
                    message = if (ok) "Laporan berhasil dihapus!" else "Gagal menghapus laporan.",
                )
            }
        }
    }

    fun clearMessage() = local.update { it.copy(message = null, error = null) }

    private fun online(): Boolean = sessions.currentToken() != null

    companion object {
        fun from(container: AppContainer): ReportViewModel {
            val user = container.tokenStore.cachedUser()
            return ReportViewModel(
                repos = container.repositories,
                reports = container.reportRepository,
                sessions = container.sessions,
                level = user?.level ?: 0,
                operator = user?.let { it.name.ifBlank { it.username } }.orEmpty().ifBlank { "Admin" },
            )
        }
    }
}
