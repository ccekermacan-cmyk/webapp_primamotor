package id.primamotor.pos.ui.person

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.EmployeeDraft
import id.primamotor.pos.data.repo.GajiRow
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PersonFeed
import id.primamotor.pos.domain.PersonSummary
import id.primamotor.pos.domain.PersonTab
import id.primamotor.pos.ui.media.rememberPhotoCapture
import id.primamotor.pos.ui.salary.SlipDialog
import java.math.BigDecimal

private val HEADER = Color(0xFF0F172A)
private val MUTED = Color(0xFF64748B)
private val CANVAS = Color(0xFFF8FAFC)
private val CYAN = Color(0xFF0891B2)
private val AMBER = Color(0xFFB45309)
private val INDIGO = Color(0xFF4338CA)

@Composable
fun PersonRoute(container: AppContainer) {
    val vm: PersonViewModel = viewModel { PersonViewModel.from(container) }
    PersonScreen(vm)
}

@Composable
fun PersonScreen(viewModel: PersonViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val people by viewModel.people.collectAsStateWithLifecycle()
    val staff by viewModel.staff.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    val historySummary by viewModel.historySummary.collectAsStateWithLifecycle()
    val gaji by viewModel.gaji.collectAsStateWithLifecycle()
    val bon by viewModel.bon.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val config = LocalConfiguration.current

    LaunchedEffect(config.screenHeightDp) {
        viewModel.setPerPage(PersonFeed.perPageFor(config.screenHeightDp))
    }

    LaunchedEffect(state.message, state.error) {
        val text = state.error ?: state.message
        text?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    LaunchedEffect(state.tab, viewModel.isAdmin) {
        if (state.tab == PersonTab.STAFF && !viewModel.isAdmin) viewModel.selectTab(PersonTab.ALL)
    }

    Scaffold(
        containerColor = CANVAS,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            Button(
                onClick = { if (state.tab == PersonTab.STAFF) viewModel.newEmployee() else viewModel.newPerson() },
                modifier = Modifier.heightIn(min = 52.dp).testTag("person_add"),
            ) {
                Text(
                    when (state.tab) {
                        PersonTab.STAFF -> "Add Karyawan"
                        PersonTab.SUPPLIER -> "Add Supplier"
                        PersonTab.CUSTOMER -> "Add Customer"
                        else -> "Add Cust / Supp"
                    },
                )
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Surface(color = Color(0xFFCFFAFE), shape = RoundedCornerShape(14.dp), modifier = Modifier.size(44.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("PE", fontWeight = FontWeight.Bold, color = CYAN)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text("People", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = HEADER)
                    Text(
                        "Kelola data mitra utama entitas usaha dagang desa",
                        style = MaterialTheme.typography.bodySmall,
                        color = MUTED,
                    )
                }
            }

            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PersonTab.entries.forEach { tab ->
                    if (tab == PersonTab.STAFF && !viewModel.isAdmin) return@forEach
                    TabPill(tab.label, state.tab == tab, "person_tab_${tab.name.lowercase()}") {
                        viewModel.selectTab(tab)
                    }
                }
            }

            OutlinedTextField(
                value = state.searchInput,
                onValueChange = viewModel::setSearchInput,
                placeholder = {
                    Text(
                        if (state.tab == PersonTab.STAFF) "Cari Karyawan..." else "Cari Customer/Supplier...",
                        fontSize = 13.sp,
                    )
                },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).testTag("person_search"),
            )

            if (state.tab == PersonTab.STAFF && viewModel.canFilterStaff) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "all" to "Semua Level",
                        "1" to "Level 1",
                        "2" to "Level 2",
                        "10" to "Level 10",
                    ).forEach { (value, label) ->
                        FilterChip(
                            selected = state.levelFilter == value,
                            onClick = { viewModel.setLevel(value) },
                            label = { Text(label, fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 40.dp),
                        )
                    }
                    listOf("all" to "Semua Status", "active" to "Aktif", "inactive" to "Nonaktif").forEach { (value, label) ->
                        FilterChip(
                            selected = state.statusFilter == value,
                            onClick = { viewModel.setStatus(value) },
                            label = { Text(label, fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 40.dp),
                        )
                    }
                }
            }

            if (state.tab == PersonTab.STAFF) {
                val pages = PersonFeed.pagesOf(staff.size, state.perPage)
                val page = state.page.coerceIn(1, pages)
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (staff.isEmpty()) item { EmptyText("Tidak ada data karyawan.") }
                    items(PersonFeed.pageOf(staff, page, state.perPage), key = { it.id }) { row ->
                        StaffCard(
                            row = row,
                            onOpen = { viewModel.showEmployee(row) },
                            onEdit = { viewModel.editEmployee(row) },
                            onDelete = { viewModel.askDeleteEmployee(row) },
                        )
                    }
                    if (staff.isNotEmpty()) {
                        item { Pager(page, pages, "person_page", viewModel::setPage) }
                    }
                }
            } else {
                val pages = PersonFeed.pagesOf(people.size, state.perPage)
                val page = state.page.coerceIn(1, pages)
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (people.isEmpty()) item { EmptyText("Tidak ada data person ditemukan untuk filter ini.") }
                    items(PersonFeed.pageOf(people, page, state.perPage), key = { it.id }) { row ->
                        PersonCard(
                            row = row,
                            onOpen = { viewModel.showPerson(row) },
                            onEdit = { viewModel.editPerson(row) },
                            onDelete = { viewModel.askDeletePerson(row) },
                        )
                    }
                    if (people.isNotEmpty()) {
                        item { Pager(page, pages, "person_page", viewModel::setPage) }
                    }
                }
            }
        }
    }

    state.detailPerson?.let { row ->
        PersonDetailSheet(
            row = row,
            tab = state.detailTab,
            summary = historySummary,
            history = history,
            page = state.historyPage,
            onTab = viewModel::setDetailTab,
            onPage = viewModel::setHistoryPage,
            onEdit = { viewModel.editPerson(row) },
            onDelete = { viewModel.askDeletePerson(row) },
            onDismiss = viewModel::closeDetail,
        )
    }

    state.detailEmployee?.let { row ->
        EmployeeDetailSheet(
            row = row,
            tab = state.detailTab,
            gaji = gaji,
            bon = bon,
            gajiPage = state.gajiPage,
            bonPage = state.bonPage,
            canEdit = viewModel.level in 1..6,
            onTab = viewModel::setDetailTab,
            onGajiPage = viewModel::setGajiPage,
            onBonPage = viewModel::setBonPage,
            onSlip = viewModel::showSlip,
            onEdit = { viewModel.editEmployee(row) },
            onDelete = { viewModel.askDeleteEmployee(row) },
            onDismiss = viewModel::closeDetail,
        )
    }

    state.slip?.let { slip -> SlipDialog(slip, viewModel::closeSlip) }

    state.personDraft?.let { draft ->
        PersonFormSheet(
            draft = draft,
            freeTextTipe = viewModel.level == 1 || viewModel.level == 2,
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updatePerson,
            onSave = viewModel::savePerson,
            onDismiss = viewModel::closeForm,
        )
    }

    state.employeeDraft?.let { draft ->
        EmployeeFormSheet(
            draft = draft,
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updateEmployee,
            onSave = viewModel::saveEmployee,
            onDismiss = viewModel::closeForm,
        )
    }

    val deleteTarget = state.deletePerson?.nama ?: state.deleteEmployee?.let { it.name.ifBlank { it.username } }
    if (deleteTarget != null) {
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text(if (state.deleteEmployee != null) "Hapus User" else "Hapus Data Person") },
            text = {
                Text("Yakin ingin menghapus $deleteTarget secara permanen? Penghapusan diverifikasi ke server dan ditolak bila hak akses tidak cukup.")
            },
            confirmButton = {
                TextButton(
                    onClick = viewModel::confirmDelete,
                    modifier = Modifier.testTag("person_delete_confirm"),
                ) { Text(if (state.deleting) "Menghapus..." else "Hapus", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }
}

@Composable
private fun TabPill(label: String, selected: Boolean, tag: String, onClick: () -> Unit) {
    Surface(
        color = if (selected) HEADER else Color.White,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (selected) HEADER else Color(0xFFE2E8F0)),
        modifier = Modifier.heightIn(min = 44.dp).clickable(onClick = onClick).testTag(tag),
    ) {
        Box(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) Color.White else MUTED,
            )
        }
    }
}

@Composable
private fun EmptyText(text: String) {
    Text(text, fontSize = 12.sp, color = MUTED, modifier = Modifier.fillMaxWidth().padding(24.dp))
}

@Composable
private fun Pager(page: Int, pages: Int, tag: String, onPage: (Int) -> Unit) {
    if (pages <= 1) {
        Text("Halaman 1 Dari 1", fontSize = 10.sp, color = MUTED, modifier = Modifier.fillMaxWidth().padding(top = 6.dp))
        return
    }
    Row(
        Modifier.fillMaxWidth().padding(top = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(
            onClick = { onPage(page - 1) },
            enabled = page > 1,
            modifier = Modifier.heightIn(min = 44.dp).testTag("${tag}_prev"),
        ) { Text("Prev") }
        Text("Halaman $page Dari $pages", fontSize = 10.sp, color = MUTED)
        OutlinedButton(
            onClick = { onPage(page + 1) },
            enabled = page < pages,
            modifier = Modifier.heightIn(min = 44.dp).testTag("${tag}_next"),
        ) { Text("Next") }
    }
}

@Composable
private fun Avatar(initials: String, staff: Boolean) {
    Box(
        Modifier.size(44.dp).background(
            if (staff) Color(0xFFE0E7FF) else Color(0xFFCFFAFE),
            RoundedCornerShape(14.dp),
        ),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (staff) INDIGO else CYAN)
    }
}

@Composable
private fun PersonCard(row: PersonRow, onOpen: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit) {
    val isCustomer = row.jenis.equals("Customer", ignoreCase = true)
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen).testTag("person_row_${row.id}"),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(PersonFeed.initials(row.nama), staff = false)
            Column(Modifier.weight(1f).padding(start = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(row.nama, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = HEADER)
                Text(
                    row.keterangan.ifBlank { "No description" },
                    fontSize = 11.sp,
                    color = MUTED,
                    maxLines = 1,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = if (isCustomer) Color(0xFFCFFAFE) else Color(0xFFFEF3C7),
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            row.jenis.ifBlank { "-" },
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isCustomer) CYAN else AMBER,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    Text("#${row.idLama.ifBlank { row.id }}", fontSize = 9.sp, color = MUTED)
                }
            }
            TextButton(onClick = onEdit, modifier = Modifier.heightIn(min = 44.dp)) { Text("Edit", fontSize = 11.sp) }
            TextButton(onClick = onDelete, modifier = Modifier.heightIn(min = 44.dp)) {
                Text("Hapus", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun StaffCard(row: UserRow, onOpen: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen).testTag("staff_row_${row.id}"),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(PersonFeed.initials(row.name.ifBlank { row.username }), staff = true)
            Column(Modifier.weight(1f).padding(start = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(row.name.ifBlank { row.username }, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = HEADER)
                Text(
                    "${row.email} • @${row.username}",
                    fontSize = 10.sp,
                    color = MUTED,
                    maxLines = 1,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Color(0xFFE0E7FF), shape = RoundedCornerShape(6.dp)) {
                        Text(
                            PersonFeed.levelBadge(row.level),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = INDIGO,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    Text(
                        if (row.status.equals("active", ignoreCase = true)) "Aktif" else "Nonaktif",
                        fontSize = 9.sp,
                        color = if (row.status.equals("active", ignoreCase = true)) Color(0xFF047857) else Color(0xFFBE123C),
                    )
                }
            }
            TextButton(onClick = onEdit, modifier = Modifier.heightIn(min = 44.dp)) { Text("Edit", fontSize = 11.sp) }
            TextButton(onClick = onDelete, modifier = Modifier.heightIn(min = 44.dp)) {
                Text("Hapus", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PersonDetailSheet(
    row: PersonRow,
    tab: PersonDetailTab,
    summary: PersonSummary,
    history: List<MenuRow>,
    page: Int,
    onTab: (PersonDetailTab) -> Unit,
    onPage: (Int) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    val isCustomer = row.jenis.equals("Customer", ignoreCase = true)
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Avatar(PersonFeed.initials(row.nama), staff = !isCustomer)
                Column(Modifier.weight(1f)) {
                    Text(row.nama, style = MaterialTheme.typography.titleLarge, color = HEADER)
                    Text(
                        row.keterangan.ifBlank { "Partner Eksternal" },
                        fontSize = 12.sp,
                        color = MUTED,
                    )
                    Text(
                        if (isCustomer) "Customer" else "Supplier",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isCustomer) CYAN else AMBER,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TabPill("Overview", tab == PersonDetailTab.PERSON_OVERVIEW, "person_detail_overview") {
                    onTab(PersonDetailTab.PERSON_OVERVIEW)
                }
                TabPill("History", tab == PersonDetailTab.PERSON_HISTORY, "person_detail_history") {
                    onTab(PersonDetailTab.PERSON_HISTORY)
                }
            }
            HorizontalDivider()

            if (tab == PersonDetailTab.PERSON_HISTORY) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SummaryCard("Total Belanja", summary.totalBelanja, Color(0xFF0891B2), Modifier.weight(1f))
                    if (summary.totalSisa.signum() > 0) {
                        SummaryCard(
                            if (isCustomer) "Total Piutang Berjalan" else "Total Hutang Berjalan",
                            summary.totalSisa,
                            Color(0xFFE11D48),
                            Modifier.weight(1f),
                        )
                    }
                }
                if (history.isEmpty()) {
                    EmptyText("Belum ada riwayat transaksi")
                } else {
                    val pages = maxOf(1, (history.size + 4) / 5)
                    val safe = page.coerceIn(1, pages)
                    history.drop((safe - 1) * 5).take(5).forEach { menu -> HistoryRow(menu) }
                    HorizontalDivider()
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total Halaman Ini", fontSize = 10.sp, color = MUTED)
                        Text(
                            Money.formatRupiah(history.drop((safe - 1) * 5).take(5).fold(BigDecimal.ZERO) { acc, m -> acc + m.total }),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Pager(safe, pages, "person_history_page", onPage)
                }
            } else {
                Text("Alamat Lengkap", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MUTED)
                Text(
                    PersonFeed.addressOf(row).ifBlank { "Belum ada data alamat yang diinputkan." },
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = HEADER,
                )
                DetailTile("Kontak (HP/WA)", row.phone.ifBlank { "-" })
                DetailTile("Nomor Induk (NIK)", row.number4.stripTrailingZeros().toPlainString().takeIf { row.number4.signum() > 0 } ?: "-")
                DetailTile("Tipe / Kelompok", row.text9.ifBlank { "-" })
                DetailTile("ID Rekam Internal", "#${row.idLama.ifBlank { row.id }}".uppercase())
            }

            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Tutup") }
                Button(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("person_detail_edit")) {
                    Text("Edit ${if (isCustomer) "Customer" else "Supplier"}", fontSize = 11.sp)
                }
                OutlinedButton(onClick = onDelete, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Hapus", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun HistoryRow(menu: MenuRow) {
    Surface(color = Color.White, border = BorderStroke(1.dp, Color(0xFFE2E8F0)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(PersonFeed.dateTimeLabel(menu.createdAt), fontSize = 9.sp, color = MUTED)
                Text(
                    if (menu.status.equals("lunas", ignoreCase = true)) "LUNAS" else "BELUM",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (menu.status.equals("lunas", ignoreCase = true)) Color(0xFF047857) else Color(0xFFBE123C),
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                Column {
                    Text(menu.jenis.ifBlank { "Transaksi" }, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = HEADER)
                    Text("Opr: ${menu.operator.ifBlank { "-" }}", fontSize = 9.sp, color = MUTED)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(Money.formatRupiah(menu.total), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    val sisa = menu.total - menu.dibayar
                    if (!menu.status.equals("lunas", ignoreCase = true) && sisa.signum() > 0) {
                        Text("Sisa: ${Money.formatRupiah(sisa)}", fontSize = 9.sp, color = Color(0xFFE11D48))
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: BigDecimal, color: Color, modifier: Modifier = Modifier) {
    Surface(color = color, shape = RoundedCornerShape(14.dp), modifier = modifier) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.8f))
            Text(Money.formatRupiah(value), fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}

@Composable
private fun DetailTile(label: String, value: String) {
    Surface(color = Color.White, border = BorderStroke(1.dp, Color(0xFFE2E8F0)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(10.dp)) {
            Text(label.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Bold, color = MUTED)
            Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HEADER)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmployeeDetailSheet(
    row: UserRow,
    tab: PersonDetailTab,
    gaji: List<GajiRow>,
    bon: List<CashflowRow>,
    gajiPage: Int,
    bonPage: Int,
    canEdit: Boolean,
    onTab: (PersonDetailTab) -> Unit,
    onGajiPage: (Int) -> Unit,
    onBonPage: (Int) -> Unit,
    onSlip: (GajiRow) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Avatar(PersonFeed.initials(row.name.ifBlank { row.username }), staff = true)
                Column(Modifier.weight(1f)) {
                    Text(row.name.ifBlank { row.username }, style = MaterialTheme.typography.titleLarge, color = HEADER)
                    Text("@${row.username}", fontSize = 12.sp, color = MUTED)
                    Text(
                        PersonFeed.levelBadge(row.level),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = INDIGO,
                    )
                }
            }
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TabPill("Overview", tab == PersonDetailTab.USER_OVERVIEW, "staff_detail_overview") {
                    onTab(PersonDetailTab.USER_OVERVIEW)
                }
                TabPill("Gaji", tab == PersonDetailTab.USER_GAJI, "staff_detail_gaji") {
                    onTab(PersonDetailTab.USER_GAJI)
                }
                TabPill("Bon", tab == PersonDetailTab.USER_BON, "staff_detail_bon") {
                    onTab(PersonDetailTab.USER_BON)
                }
            }
            HorizontalDivider()

            when (tab) {
                PersonDetailTab.USER_GAJI -> {
                    if (gaji.isEmpty()) {
                        EmptyText("Belum ada riwayat penerimaan gaji")
                    } else {
                        val pages = maxOf(1, (gaji.size + 4) / 5)
                        val safe = gajiPage.coerceIn(1, pages)
                        gaji.drop((safe - 1) * 5).take(5).forEach { slip ->
                            Surface(color = Color.White, border = BorderStroke(1.dp, Color(0xFFE2E8F0)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(slip.createdAt, fontSize = 9.sp, color = MUTED)
                                        Text(Money.formatRupiah(slip.diterima), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF047857))
                                    }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text("Operator: ${slip.person}", fontSize = 10.sp, color = MUTED)
                                        TextButton(onClick = { onSlip(slip) }, modifier = Modifier.heightIn(min = 40.dp)) {
                                            Text("Detail slip", fontSize = 10.sp)
                                        }
                                    }
                                }
                            }
                        }
                        Pager(safe, pages, "staff_gaji_page", onGajiPage)
                    }
                }

                PersonDetailTab.USER_BON -> {
                    DetailTile("Total sisa bon berjalan", Money.formatRupiah(row.number1))
                    if (bon.isEmpty()) {
                        EmptyText("Belum ada riwayat bon karyawan")
                    } else {
                        val pages = maxOf(1, (bon.size + 4) / 5)
                        val safe = bonPage.coerceIn(1, pages)
                        bon.drop((safe - 1) * 5).take(5).forEach { entry ->
                            Surface(color = Color.White, border = BorderStroke(1.dp, Color(0xFFE2E8F0)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(PersonFeed.dateTimeLabel(entry.createdAt), fontSize = 9.sp, color = MUTED)
                                        Text("Nominal: ${Money.formatRupiah(entry.nominal)}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7E22CE))
                                    }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Mutasi/Ket: ${entry.note.ifBlank { "Transaksi Bon" }}", fontSize = 10.sp, color = MUTED)
                                        Text("Opr: ${entry.operator.ifBlank { "-" }}", fontSize = 10.sp, color = MUTED)
                                    }
                                }
                            }
                        }
                        Pager(safe, pages, "staff_bon_page", onBonPage)
                    }
                }

                else -> {
                    Surface(
                        color = Color(0xFFEEF2FF),
                        border = BorderStroke(1.dp, Color(0xFFC7D2FE)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Informasi Karyawan", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = INDIGO)
                                Text(row.name.ifBlank { row.username }, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = HEADER)
                            }
                            Text(
                                if (row.status.equals("active", ignoreCase = true)) "Aktif" else "Nonaktif",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (row.status.equals("active", ignoreCase = true)) Color(0xFF047857) else Color(0xFFBE123C),
                            )
                        }
                    }
                    DetailTile("Status", if (row.status.equals("active", ignoreCase = true)) "Aktif" else "Nonaktif")
                    DetailTile("Username", "@${row.username.ifBlank { "-" }}")
                    DetailTile("Level Jabatan", PersonFeed.levelBadge(row.level))
                    DetailTile("Email", row.email.ifBlank { "-" })
                    DetailTile("Telepon / WA", row.phone.ifBlank { "-" })
                }
            }

            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Tutup") }
                if (canEdit) {
                    Button(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("staff_detail_edit")) {
                        Text("Edit User Karyawan", fontSize = 11.sp)
                    }
                }
                OutlinedButton(onClick = onDelete, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Hapus", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PersonFormSheet(
    draft: MasterDraft,
    freeTextTipe: Boolean,
    saving: Boolean,
    error: String?,
    onChange: ((MasterDraft) -> MasterDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val capture = rememberPhotoCapture { path -> onChange { it.copy(mediaPath = path) } }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                if (draft.id == null) "Tambah Partner Baru" else "Edit Rekor Partner",
                style = MaterialTheme.typography.titleLarge,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Customer" to "Pelanggan", "Supplier" to "Supplier").forEach { (jenis, tipe) ->
                    FilterChip(
                        selected = draft.jenis == jenis,
                        onClick = { onChange { it.copy(jenis = jenis, text9 = tipe) } },
                        label = { Text(jenis, fontSize = 11.sp) },
                        modifier = Modifier.testTag("person_jenis_${jenis.lowercase()}"),
                    )
                }
            }
            Field("Nama Cust / Supplier *", draft.text1, "person_nama", "Cth: Budi Santoso") { value -> onChange { it.copy(text1 = value) } }
            Field("Nama Bengkel / Perusahaan", draft.text2, "person_toko", "Cth: PT Makmur Jaya") { value -> onChange { it.copy(text2 = value) } }
            Field("NIK", draft.number4, "person_nik", "Cth: 3500000000000", KeyboardType.Number) { value ->
                onChange { it.copy(number4 = value.filter(Char::isDigit)) }
            }
            Field("Nomor HP / WhatsApp", draft.phone, "person_phone", "Cth: 08123456789", KeyboardType.Phone) { value ->
                onChange { it.copy(phone = value) }
            }
            Field("Dusun / Jalan", draft.text3, "person_dusun", "Cth: Dusun Krajan") { value -> onChange { it.copy(text3 = value) } }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Field("RT", draft.number2, "person_rt", "00", KeyboardType.Number, Modifier.weight(1f)) { value ->
                    onChange { it.copy(number2 = value.filter(Char::isDigit)) }
                }
                Field("RW", draft.number3, "person_rw", "00", KeyboardType.Number, Modifier.weight(1f)) { value ->
                    onChange { it.copy(number3 = value.filter(Char::isDigit)) }
                }
            }
            Field("Desa", draft.text4, "person_desa", "") { value -> onChange { it.copy(text4 = value) } }
            Field("Kecamatan", draft.text5, "person_kecamatan", "") { value -> onChange { it.copy(text5 = value) } }
            Field("Kota / Kabupaten", draft.text6, "person_kota", "") { value -> onChange { it.copy(text6 = value) } }
            Field("Provinsi", draft.text7, "person_provinsi", "") { value -> onChange { it.copy(text7 = value) } }
            Field("Tipe / Kelompok", draft.text9, "person_tipe", if (freeTextTipe) "Bebas ketik kategori (Misal: VIP)" else "") { value ->
                onChange { it.copy(text9 = value) }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = capture, modifier = Modifier.heightIn(min = 44.dp)) {
                    Text(if (draft.mediaPath == null) "+ Upload Foto" else "Ganti Foto", fontSize = 11.sp)
                }
                if (draft.mediaPath != null) {
                    Text("Foto siap diunggah", fontSize = 10.sp, color = MUTED)
                    TextButton(onClick = { onChange { it.copy(mediaPath = null) } }) { Text("X", fontSize = 10.sp) }
                }
            }

            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("person_error"))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Batalkan") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.weight(2f).heightIn(min = 48.dp).testTag("person_save")) {
                    Text(if (saving) "MENYIMPAN..." else "SAVE PARTNER")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmployeeFormSheet(
    draft: EmployeeDraft,
    saving: Boolean,
    error: String?,
    onChange: ((EmployeeDraft) -> EmployeeDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val capture = rememberPhotoCapture { path -> onChange { it.copy(mediaPath = path) } }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                if (draft.id == null) "Tambah Karyawan Baru" else "Edit Data Karyawan",
                style = MaterialTheme.typography.titleLarge,
            )
            Field("Nama Lengkap *", draft.name, "employee_nama", "Cth: Budi Santoso") { value -> onChange { it.copy(name = value) } }
            Field("Username *", draft.username, "employee_username", "Cth: budi123", enabled = draft.id == null) { value ->
                onChange { it.copy(username = value) }
            }
            Field("Email *", draft.email, "employee_email", "Cth: budi@primamotor.com", KeyboardType.Email) { value ->
                onChange { it.copy(email = value) }
            }
            if (draft.id == null) {
                Field("Password Akses Login", draft.password, "employee_password", "Default: password123") { value ->
                    onChange { it.copy(password = value) }
                }
            }
            Text("Level Otoritas", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MUTED)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(
                    1 to "Lv 1 Admin Utama",
                    2 to "Lv 2 Admin",
                    3 to "Lv 3 Manager",
                    4 to "Lv 4 Supervisor",
                    5 to "Lv 5 Kasir",
                    6 to "Lv 6 Staff",
                    7 to "Lv 7 Mekanik",
                    10 to "Lv 10 Mekanik Senior",
                ).forEach { (value, label) ->
                    FilterChip(
                        selected = draft.level == value,
                        onClick = { onChange { it.copy(level = value) } },
                        label = { Text(label, fontSize = 10.sp) },
                        modifier = Modifier.heightIn(min = 40.dp),
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("active" to "Active (Aktif)", "inactive" to "Inactive (Nonaktif)").forEach { (value, label) ->
                    FilterChip(
                        selected = draft.status.equals(value, ignoreCase = true),
                        onClick = { onChange { it.copy(status = value) } },
                        label = { Text(label, fontSize = 10.sp) },
                        modifier = Modifier.heightIn(min = 40.dp),
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = capture, modifier = Modifier.heightIn(min = 44.dp)) {
                    Text(if (draft.mediaPath == null) "+ Upload Avatar" else "Ganti Avatar", fontSize = 11.sp)
                }
                if (draft.mediaPath != null) {
                    Text("Avatar siap diunggah", fontSize = 10.sp, color = MUTED)
                    TextButton(onClick = { onChange { it.copy(mediaPath = null) } }) { Text("X", fontSize = 10.sp) }
                }
            }
            Field("Link URL Foto Profil (link_image)", draft.linkImage, "employee_link_image", "https://...") { value ->
                onChange { it.copy(linkImage = value) }
            }
            Field("Nomor Telepon / HP (phone)", draft.phone, "employee_phone", "Cth: 08123456789", KeyboardType.Phone) { value ->
                onChange { it.copy(phone = value) }
            }
            Field("Angka / Poin / Nominal Tambahan (number)", draft.number, "employee_number", "0", KeyboardType.Number) { value ->
                onChange { it.copy(number = value.filter { c -> c.isDigit() || c == '-' }) }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = draft.emailVisibility,
                    onCheckedChange = { value -> onChange { it.copy(emailVisibility = value) } },
                )
                Text("Tampilkan Email (emailVisibility)", fontSize = 11.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = draft.verified,
                    onCheckedChange = { value -> onChange { it.copy(verified = value) } },
                )
                Text("Status Terverifikasi (verified)", fontSize = 11.sp)
            }

            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("employee_error"))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.weight(2f).heightIn(min = 48.dp).testTag("employee_save")) {
                    Text(if (saving) "MENYIMPAN..." else "SIMPAN USER")
                }
            }
        }
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    tag: String,
    placeholder: String,
    keyboard: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, fontSize = 11.sp) },
        placeholder = if (placeholder.isBlank()) null else {
            { Text(placeholder, fontSize = 11.sp) }
        },
        singleLine = true,
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        textStyle = MaterialTheme.typography.bodyMedium,
        modifier = modifier.fillMaxWidth().testTag(tag),
    )
}
