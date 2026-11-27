package id.primamotor.pos.ui.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.ui.EmptyHint
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.material3.OutlinedButton

@Composable
fun MasterSettingsRoute(container: AppContainer) {
    val user = container.tokenStore.cachedUser()
    val vm: MasterSettingsViewModel = viewModel {
        MasterSettingsViewModel(
            container = container,
            operator = user?.name.orEmpty().ifBlank { user?.username.orEmpty() },
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
    val jenisTabs by viewModel.jenisTabs.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Settings Master Data", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Kelola jenis, kategori, dan label master data",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Button(
                    onClick = { viewModel.add("", "") },
                    enabled = viewModel.isSuperAdmin,
                    modifier = Modifier.heightIn(min = 48.dp).testTag("settings_add"),
                ) { Text("Tambah Master Data") }
            }

            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                label = { Text("Cari jenis, kategori, atau label master data...") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("settings_search"),
            )

            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    FilterChip(
                        selected = state.jenisTab == "all",
                        onClick = { viewModel.setJenis("all") },
                        label = { Text("Semua Jenis") },
                    )
                }
                items(jenisTabs, key = { it }) { jenis ->
                    FilterChip(
                        selected = state.jenisTab == jenis,
                        onClick = { viewModel.setJenis(jenis) },
                        label = { Text(jenis) },
                    )
                }
            }

            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                item(key = "device") {
                    OutlinedButton(
                        onClick = { showDeviceSettings = true },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("settings_device"),
                    ) { Text("Printer & Sinkron") }
                }
                if (items.isEmpty()) item { EmptyHint() }
                val grouped = items.groupBy { it.jenis.ifBlank { "Lainnya" } }
                grouped.forEach { (jenis, group) ->
                    item(key = "jenis_$jenis") {
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                jenis.uppercase(),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(
                                onClick = {
                                    viewModel.add(jenis, group.firstOrNull()?.kategori.orEmpty())
                                },
                                enabled = viewModel.isSuperAdmin,
                            ) { Text("Tambah") }
                        }
                    }
                    val byKategori = group.groupBy { it.kategori.ifBlank { "Umum" } }
                    byKategori.forEach { (kategori, categoryItems) ->
                        item(key = "kategori_${jenis}_$kategori") {
                            Text(
                                kategori,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        items(categoryItems, key = { it.id }) { item ->
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = MaterialTheme.colorScheme.surface,
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { viewModel.edit(item) },
                            ) {
                                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(item.label, style = MaterialTheme.typography.titleSmall)
                                        if (item.text2.isNotBlank()) {
                                            Text(
                                                item.text2,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                    }
                                    Text("Detail", style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    state.draft?.let { draft ->
        MasterFormSheet(
            draft = draft,
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

    if (state.deleteTarget != null) {
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Data") },
            text = { Text("Yakin ingin menghapus master data ini? Penghapusan dikirim ke server saat tersambung.") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete) {
                    Text("Hapus", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MasterFormSheet(
    draft: MasterDraft,
    saving: Boolean,
    error: String?,
    onChange: ((MasterDraft) -> MasterDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                if (draft.id == null) "Tambah Master Data" else "Ubah Master Data",
                style = MaterialTheme.typography.titleLarge,
            )

            OutlinedTextField(
                value = draft.kategori,
                onValueChange = { value -> onChange { it.copy(kategori = value) } },
                label = { Text("Kategori *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("settings_kategori"),
            )
            OutlinedTextField(
                value = draft.jenis,
                onValueChange = { value -> onChange { it.copy(jenis = value) } },
                label = { Text("Jenis (Section) *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("settings_jenis"),
            )
            OutlinedTextField(
                value = draft.text1,
                onValueChange = { value -> onChange { it.copy(text1 = value) } },
                label = { Text("Label Utama (Text 1) *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("settings_text1"),
            )
            OutlinedTextField(
                value = draft.text2,
                onValueChange = { value -> onChange { it.copy(text2 = value) } },
                label = { Text("Text 2") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.text3,
                onValueChange = { value -> onChange { it.copy(text3 = value) } },
                label = { Text("Text 3") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.alamat,
                onValueChange = { value -> onChange { it.copy(alamat = value) } },
                label = { Text("Alamat") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.phone,
                onValueChange = { value -> onChange { it.copy(phone = value) } },
                label = { Text("No. Telepon") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.number1,
                onValueChange = { value -> onChange { it.copy(number1 = value.filter { c -> c.isDigit() || c == '-' }) } },
                label = { Text("Number 1") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.number2,
                onValueChange = { value -> onChange { it.copy(number2 = value.filter { c -> c.isDigit() || c == '-' }) } },
                label = { Text("Number 2") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.enum1,
                onValueChange = { value -> onChange { it.copy(enum1 = value) } },
                label = { Text("Enum 1") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.visibilitas,
                onValueChange = { value -> onChange { it.copy(visibilitas = value) } },
                label = { Text("Visibilitas Akses (Level User)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.linkImage,
                onValueChange = { value -> onChange { it.copy(linkImage = value) } },
                label = { Text("Link Gambar") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("settings_error"))
            }
            HorizontalDivider()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.heightIn(min = 48.dp).testTag("settings_save")) {
                    Text(if (saving) "Menyimpan..." else "Simpan")
                }
            }
        }
    }
}
