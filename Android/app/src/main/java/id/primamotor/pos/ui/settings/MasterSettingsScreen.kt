package id.primamotor.pos.ui.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.MasterDraft

private val INDIGO = Color(0xFF4F46E5)
private val INDIGO_LIGHT = Color(0xFFEEF2FF)
private val SLATE = Color(0xFF334155)
private val SLATE_MUTED = Color(0xFF64748B)
private val HAIRLINE = Color(0xFFE2E8F0)
private val CANVAS = Color(0xFFF8FAFC)

@Composable
fun MasterSettingsRoute(container: AppContainer) {
    val user = container.tokenStore.cachedUser()
    val vm: MasterSettingsViewModel = viewModel {
        MasterSettingsViewModel(
            container = container,
            operator = user?.username.orEmpty().ifBlank { "Admin" },
            isSuperAdmin = user?.level == 1,
        )
    }
    MasterSettingsScreen(vm, container)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MasterSettingsScreen(viewModel: MasterSettingsViewModel, container: AppContainer) {
    var showDeviceSettings by remember { mutableStateOf(false) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val items by viewModel.items.collectAsStateWithLifecycle()
    val tabs by viewModel.jenisTabs.collectAsStateWithLifecycle()
    val kategoriOptions by viewModel.kategoriOptions.collectAsStateWithLifecycle()
    val userOptions by viewModel.userOptions.collectAsStateWithLifecycle()
    val jenisOptions by viewModel.jenisOptions.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = CANVAS,
        floatingActionButton = {
            if (viewModel.isSuperAdmin) {
                Button(
                    onClick = { viewModel.add("", "") },
                    modifier = Modifier.heightIn(min = 52.dp).testTag("settings_add_mobile"),
                ) { Text("+ Master Data") }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Settings Master Data", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        "Kelola jenis, kategori, dan label master data",
                        style = MaterialTheme.typography.bodySmall,
                        color = SLATE_MUTED,
                    )
                }
                OutlinedButton(
                    onClick = { showDeviceSettings = true },
                    modifier = Modifier.heightIn(min = 48.dp).testTag("settings_device"),
                ) { Text("Printer & Sinkron") }
                if (viewModel.isSuperAdmin) {
                    Button(
                        onClick = { viewModel.add("", "") },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("settings_add"),
                    ) { Text("Tambah Master Data") }
                }
            }

            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    FilterChip(
                        selected = state.jenisTab == "all",
                        onClick = { viewModel.setJenis("all") },
                        label = { Text("Semua Jenis (${tabs.sumOf { it.second }})") },
                        modifier = Modifier.heightIn(min = 44.dp),
                    )
                }
                items(tabs, key = { it.first }) { (jenis, count) ->
                    FilterChip(
                        selected = state.jenisTab == jenis,
                        onClick = { viewModel.setJenis(jenis) },
                        label = { Text("${jenis.uppercase()} ($count)") },
                        modifier = Modifier.heightIn(min = 44.dp),
                    )
                }
            }

            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                placeholder = { Text("Cari jenis, kategori, atau label master data...") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("settings_search"),
            )

            if (items.isEmpty()) {
                Text(
                    "Tidak ada data master.",
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    color = SLATE_MUTED,
                )
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items.groupBy { it.jenis.ifBlank { "Lainnya" } }.forEach { (jenis, group) ->
                        item(key = "jenis_$jenis") {
                            Row(
                                Modifier.fillMaxWidth().padding(top = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(jenis.uppercase(), fontWeight = FontWeight.Bold, color = SLATE, modifier = Modifier.weight(1f))
                                Surface(color = INDIGO_LIGHT, shape = RoundedCornerShape(8.dp)) {
                                    Text(
                                        "${group.size} Item",
                                        color = INDIGO,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    )
                                }
                                if (viewModel.isSuperAdmin) {
                                    TextButton(onClick = { viewModel.add(jenis, "") }) { Text("Tambah item di $jenis") }
                                }
                            }
                        }
                        group.groupBy { it.kategori.ifBlank { "Umum" } }.forEach { (kategori, categoryItems) ->
                            item(key = "kategori_${jenis}_$kategori") {
                                Surface(
                                    color = Color.White,
                                    shape = RoundedCornerShape(14.dp),
                                    border = BorderStroke(1.dp, HAIRLINE),
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Column(Modifier.padding(12.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                kategori.uppercase(),
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SLATE_MUTED,
                                                modifier = Modifier.weight(1f),
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis,
                                            )
                                            Text("${categoryItems.size}", fontSize = 10.sp, color = SLATE_MUTED)
                                        }
                                        categoryItems.forEach { item ->
                                            MasterItemRow(
                                                item = item,
                                                canDelete = viewModel.isSuperAdmin && item.idLama != "umum1",
                                                onDelete = { viewModel.askDelete(item) },
                                                onDetail = { viewModel.showDetail(item) },
                                                onEdit = { viewModel.edit(item) },
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    state.detail?.let { item ->
        MasterDetailDialog(
            item = item,
            onEdit = { viewModel.edit(item) },
            onDelete = { viewModel.askDelete(item) },
            canDelete = viewModel.isSuperAdmin && item.idLama != "umum1",
            onDismiss = viewModel::closeDetail,
        )
    }

    state.draft?.let { draft ->
        MasterFormDialog(
            draft = draft,
            options = MasterFormOptions(jenis = jenisOptions, kategori = kategoriOptions, users = userOptions),
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updateDraft,
            onSave = viewModel::save,
            onDismiss = viewModel::closeForm,
        )
    }

    if (showDeviceSettings) {
        SettingsSheet(
            container = container,
            onLogout = { showDeviceSettings = false },
            onDismiss = { showDeviceSettings = false },
        )
    }

    state.deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Master Data") },
            text = {
                Column {
                    if (state.deleteError != null) {
                        Text(state.deleteError.orEmpty(), color = MaterialTheme.colorScheme.error)
                    }
                    Text("Hapus ${target.label}?")
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete, enabled = !state.deleting) {
                    Text(if (state.deleting) "Menghapus..." else "Hapus", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }

    state.result?.let { result ->
        AlertDialog(
            onDismissRequest = viewModel::dismissResult,
            title = { Text(result.title) },
            text = { Text(result.message) },
            confirmButton = { TextButton(onClick = viewModel::dismissResult) { Text("Oke") } },
        )
    }
}

@Composable
private fun MasterItemRow(
    item: id.primamotor.pos.ui.settings.MasterItem,
    canDelete: Boolean,
    onDelete: () -> Unit,
    onDetail: () -> Unit,
    onEdit: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).clickable(onClick = onDetail)) {
            Text(item.label, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (item.text2.isNotBlank()) {
                Text(item.text2, style = MaterialTheme.typography.bodySmall, color = SLATE_MUTED)
            }
        }
        val rupiah = item.kategori.lowercase() == "cashflow" || item.jenis.lowercase().contains("akun")
        if (item.number1.signum() != 0 || item.kategori.lowercase() == "cashflow") {
            Surface(color = Color(0xFFF1F5F9), shape = RoundedCornerShape(6.dp)) {
                Text(
                    if (rupiah) id.primamotor.pos.domain.Money.formatRupiah(item.number1) else item.number1.stripTrailingZeros().toPlainString(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp),
                )
            }
        }
        TextButton(onClick = onDetail, contentPadding = PaddingValues(2.dp)) { Text("Detail", fontSize = 11.sp) }
        TextButton(onClick = onEdit, contentPadding = PaddingValues(2.dp)) { Text("Edit", fontSize = 11.sp) }
        if (canDelete) {
            TextButton(onClick = onDelete, contentPadding = PaddingValues(2.dp)) {
                Text("Hapus", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

private data class MasterFormOptions(
    val jenis: List<String>,
    val kategori: List<String>,
    val users: List<String>,
)

@Composable
private fun MasterDetailDialog(
    item: id.primamotor.pos.ui.settings.MasterItem,
    canDelete: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxWidth(0.92f).fillMaxHeight(0.8f),
            color = Color.White,
            shape = RoundedCornerShape(20.dp),
        ) {
            Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Rincian Master Data", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Surface(color = INDIGO_LIGHT, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(10.dp)) {
                        Text(item.label, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("${item.jenis} • ${item.kategori}", fontSize = 12.sp, color = SLATE_MUTED)
                    }
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DetailTile(
                        MasterLabels.text2(item.kategori),
                        item.text2.ifBlank { "-" },
                    )
                    val rupiah = item.kategori.lowercase() == "cashflow" || item.jenis.lowercase().contains("akun")
                    DetailTile(
                        MasterLabels.number1(item.kategori, item.jenis),
                        if (rupiah) id.primamotor.pos.domain.Money.formatRupiah(item.number1) else item.number1.toPlainString(),
                    )
                    if (item.alamat.isNotBlank()) DetailTile("Alamat", item.alamat)
                    if (item.phone.isNotBlank()) DetailTile("No. Telepon", item.phone)
                    DetailTile(
                        "Visibilitas Akses",
                        if (item.visibilitas.isBlank()) {
                            "Global (Semua Level)"
                        } else {
                            item.visibilitas.split(",").mapNotNull { it.trim().takeIf(String::isNotEmpty) }
                                .joinToString(", ") { level -> "Level $level" }
                        },
                    )
                }
                HorizontalDivider()
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Button(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Edit Data") }
                    if (canDelete) {
                        OutlinedButton(onClick = onDelete, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                            Text("Hapus", color = MaterialTheme.colorScheme.error)
                        }
                    }
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(contentColor = SLATE),
                    ) { Text("Tutup") }
                }
            }
        }
    }
}

@Composable
private fun DetailTile(label: String, value: String) {
    Surface(color = CANVAS, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(10.dp)) {
            Text(label, fontSize = 11.sp, color = SLATE_MUTED)
            Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun MasterFormDialog(
    draft: MasterDraft,
    options: MasterFormOptions,
    saving: Boolean,
    error: String?,
    onChange: ((MasterDraft) -> MasterDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    var tab by remember { mutableStateOf(0) }
    val tabs = listOf("Utama", "Nilai & Extra", "Enum & Akses")

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxWidth(0.96f).fillMaxHeight(0.94f),
            color = Color.White,
            shape = RoundedCornerShape(20.dp),
        ) {
            Column(Modifier.fillMaxSize().padding(14.dp)) {
                Text(
                    if (draft.id == null) "Tambah Master Data" else "Edit Master Data",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    tabs.forEachIndexed { index, label ->
                        FilterChip(
                            selected = tab == index,
                            onClick = { tab = index },
                            label = { Text(label) },
                        )
                    }
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (tab) {
                        0 -> BasicTab(draft, options, onChange)
                        1 -> ExtraTab(draft, onChange)
                        else -> AccessTab(draft, options, onChange)
                    }
                    if (error != null) {
                        Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("settings_error"))
                    }
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss, enabled = !saving) { Text("Batal") }
                    Button(
                        onClick = onSave,
                        enabled = !saving,
                        modifier = Modifier.heightIn(min = 48.dp).testTag("settings_save"),
                    ) { Text(if (saving) "Memproses..." else "Simpan") }
                }
            }
        }
    }
}

@Composable
private fun BasicTab(
    draft: MasterDraft,
    options: MasterFormOptions,
    onChange: ((MasterDraft) -> MasterDraft) -> Unit,
) {
    ComboField(
        label = "Jenis (Section) *",
        value = draft.jenis,
        options = options.jenis,
        onPick = { value -> onChange { it.copy(jenis = value) } },
        tag = "settings_jenis",
    )
    ComboField(
        label = "Kategori *",
        value = draft.kategori,
        options = options.kategori,
        onPick = { value -> onChange { it.copy(kategori = value) } },
        tag = "settings_kategori",
    )
    Field(MasterLabels.text1(draft.kategori, draft.jenis), draft.text1, "settings_text1") { value ->
        onChange { it.copy(text1 = value) }
    }
    Field(MasterLabels.text2(draft.kategori), draft.text2, "settings_text2") { value ->
        onChange { it.copy(text2 = value) }
    }
    Field("Text 3", draft.text3, "settings_text3") { value -> onChange { it.copy(text3 = value) } }
    Field("Alamat", draft.alamat, "settings_alamat") { value -> onChange { it.copy(alamat = value) } }
    OutlinedTextField(
        value = draft.phone,
        onValueChange = { value -> onChange { it.copy(phone = value.filter { c -> c.isDigit() }) } },
        label = { Text("No. Telepon") },
        placeholder = { Text("628...") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth(),
    )
    Field("Lat Long", draft.latlong, "settings_latlong") { value -> onChange { it.copy(latlong = value) } }
}

@Composable
private fun ExtraTab(
    draft: MasterDraft,
    onChange: ((MasterDraft) -> MasterDraft) -> Unit,
) {
    Field(MasterLabels.number1(draft.kategori, draft.jenis), draft.number1, "settings_number1") { value ->
        onChange { it.copy(number1 = value) }
    }
    Field(MasterLabels.number2(draft.kategori), draft.number2, "settings_number2") { value ->
        onChange { it.copy(number2 = value) }
    }
    Field("Number 3", draft.number3, "settings_number3") { value -> onChange { it.copy(number3 = value) } }
    Field("Number 4", draft.number4, "settings_number4") { value -> onChange { it.copy(number4 = value) } }
    Field("Number 5", draft.number5, "settings_number5") { value -> onChange { it.copy(number5 = value) } }
    Field("Link Gambar", draft.linkImage, "settings_link_image") { value -> onChange { it.copy(linkImage = value) } }
    Field("Link Dokumen", draft.linkDokumen, "settings_doc") { value -> onChange { it.copy(linkDokumen = value) } }
}

@Composable
private fun AccessTab(
    draft: MasterDraft,
    options: MasterFormOptions,
    onChange: ((MasterDraft) -> MasterDraft) -> Unit,
) {
    Text("Visibilitas Akses (Level User)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    MultiSelect(
        options = MasterLabels.levelOptions.map { it.first },
        labels = MasterLabels.levelOptions.toMap(),
        selected = parseList(draft.visibilitas).map(String::trim),
    ) { selected -> onChange { it.copy(visibilitas = selected.joinToString(",")) } }

    Text(MasterLabels.enum1(draft.kategori, draft.jenis), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    MultiSelect(options = options.users, selected = parseList(draft.enum1)) { selected ->
        onChange { it.copy(enum1 = selected.joinToString(",")) }
    }
    Text("Enum 4 (User Cadangan)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    MultiSelect(options = options.users, selected = parseList(draft.enum4)) { selected ->
        onChange { it.copy(enum4 = selected.joinToString(",")) }
    }
    Text("Enum 2 (Level)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    MultiSelect(
        options = MasterLabels.levelOptions.map { it.first },
        labels = MasterLabels.levelOptions.toMap(),
        selected = parseList(draft.enum2).map(String::trim),
    ) { selected -> onChange { it.copy(enum2 = selected.joinToString(",")) } }
    Text("Enum 3 (Level Tambahan)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    MultiSelect(
        options = MasterLabels.levelOptions.map { it.first },
        labels = MasterLabels.levelOptions.toMap(),
        selected = parseList(draft.enum3).map(String::trim),
    ) { selected -> onChange { it.copy(enum3 = selected.joinToString(",")) } }
}

private fun parseList(raw: String): List<String> =
    raw.split(',').map { it.trim() }.filter { it.isNotEmpty() }

@Composable
private fun MultiSelect(
    options: List<String>,
    selected: List<String>,
    labels: Map<String, String> = emptyMap(),
    onChange: (List<String>) -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        options.takeIf { it.isNotEmpty() }?.let { items ->
            items.forEach { value ->
                val active = selected.contains(value)
                Surface(
                    color = if (active) INDIGO else Color.White,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, if (active) INDIGO else HAIRLINE),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 1.dp)
                        .clickable {
                            onChange(if (active) selected - value else selected + value)
                        },
                ) {
                    Text(
                        labels[value] ?: value,
                        color = if (active) Color.White else SLATE,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun Field(label: String, value: String, tag: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
}

@Composable
private fun ComboField(
    label: String,
    value: String,
    options: List<String>,
    onPick: (String) -> Unit,
    tag: String,
) {
    var open by remember { mutableStateOf(false) }
    val filtered = options.filter { it.contains(value, ignoreCase = true) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.weight(1f)) {
            OutlinedTextField(
                value = value,
                onValueChange = onPick,
                label = { Text(label) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag(tag),
            )
            DropdownMenu(expanded = open && filtered.isNotEmpty(), onDismissRequest = { open = false }) {
                filtered.take(12).forEach { item ->
                    DropdownMenuItem(text = { Text(item) }, onClick = { onPick(item); open = false })
                }
            }
        }
        TextButton(onClick = { open = !open }, modifier = Modifier.heightIn(min = 48.dp)) { Text("Pilih") }
    }
}
