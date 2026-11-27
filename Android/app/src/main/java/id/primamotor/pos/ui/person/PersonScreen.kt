package id.primamotor.pos.ui.person

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.EmployeeDraft
import id.primamotor.pos.data.repo.MasterDraft
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.ui.EmptyHint

@Composable
fun PersonRoute(container: AppContainer) {
    val user = container.tokenStore.cachedUser()
    val vm: PersonViewModel = viewModel {
        PersonViewModel(
            repos = container.repositories,
            masters = container.masterRepository,
            employees = container.employeeRepository,
            operator = user?.name.orEmpty().ifBlank { user?.username.orEmpty() },
            userLevel = user?.level ?: 0,
        )
    }
    PersonScreen(vm)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PersonScreen(viewModel: PersonViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val people by viewModel.people.collectAsStateWithLifecycle()
    val staff by viewModel.staff.collectAsStateWithLifecycle()
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
                    Text("People", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Kelola data mitra utama entitas usaha dagang desa",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (state.tab != PersonTab.KARYAWAN || viewModel.isAdmin) {
                Button(
                    onClick = {
                        if (state.tab == PersonTab.KARYAWAN) viewModel.newEmployee() else viewModel.newPerson()
                    },
                    modifier = Modifier.heightIn(min = 48.dp).testTag("person_add"),
                ) {
                    Text(
                        when (state.tab) {
                            PersonTab.KARYAWAN -> "Add Karyawan"
                            PersonTab.SUPPLIER -> "Add Supplier"
                            PersonTab.CUSTOMER -> "Add Customer"
                            else -> "Add Cust / Supp"
                        },
                    )
                }
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PersonTab.entries.forEach { tab ->
                    FilterChip(
                        selected = state.tab == tab,
                        onClick = { viewModel.selectTab(tab) },
                        label = { Text(tab.label) },
                        modifier = Modifier.heightIn(min = 44.dp).testTag("person_tab_${tab.name.lowercase()}"),
                    )
                }
            }

            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                label = {
                    Text(if (state.tab == PersonTab.KARYAWAN) "Cari Karyawan..." else "Cari Customer/Supplier...")
                },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("person_search"),
            )

            if (state.tab == PersonTab.KARYAWAN) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    LevelFilter.entries.forEach { option ->
                        FilterChip(
                            selected = state.levelFilter == option.value,
                            onClick = { viewModel.setLevel(option.value) },
                            label = { Text(option.label) },
                            modifier = Modifier.heightIn(min = 40.dp),
                        )
                    }
                    FilterChip(
                        selected = state.statusFilter == "active",
                        onClick = { viewModel.setStatus(if (state.statusFilter == "active") "all" else "active") },
                        label = { Text("Aktif") },
                        modifier = Modifier.heightIn(min = 40.dp),
                    )
                }
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (staff.isEmpty()) item { EmptyHint() }
                    items(staff, key = { it.id }) { row ->
                        PersonCard(
                            title = row.name.ifBlank { row.username },
                            subtitle = "@${row.username}",
                            meta = "${levelLabel(row.level)} • ${if (row.status.equals("active", true)) "Aktif" else "Nonaktif"}",
                            onClick = { viewModel.showEmployee(row) },
                        )
                    }
                }
            } else {
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (people.isEmpty()) item { EmptyHint() }
                    items(people, key = { it.id }) { row ->
                        PersonCard(
                            title = row.nama,
                            subtitle = row.keterangan.ifBlank { row.phone },
                            meta = "${row.jenis} • ${row.idLama.ifBlank { row.id }}",
                            onClick = { viewModel.showPerson(row) },
                        )
                    }
                }
            }
        }
    }

    state.detailPerson?.let { row ->
        PersonDetailSheet(
            row = row,
            isAdmin = viewModel.isAdmin,
            onEdit = { viewModel.editPerson(row) },
            onDelete = { viewModel.askDeletePerson(row) },
            onDismiss = viewModel::closeDetail,
        )
    }

    state.detailEmployee?.let { row ->
        EmployeeDetailSheet(
            row = row,
            isAdmin = viewModel.isAdmin,
            onEdit = { viewModel.editEmployee(row) },
            onDelete = { viewModel.askDeleteEmployee(row) },
            onDismiss = viewModel::closeDetail,
        )
    }

    state.personDraft?.let { draft ->
        PersonFormSheet(
            draft = draft,
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

    val deleting = state.deletePerson != null || state.deleteEmployee != null
    if (deleting) {
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Data") },
            text = {
                Text(
                    "Yakin ingin menghapus data ini secara permanen? Penghapusan dikirim ke server saat tersambung dan ditolak bila hak akses tidak cukup.",
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete, modifier = Modifier.testTag("person_delete_confirm")) {
                    Text("Hapus", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }
}

@Composable
private fun PersonCard(title: String, subtitle: String, meta: String, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(44.dp).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(title.trim().take(2).uppercase(), style = MaterialTheme.typography.labelLarge)
            }
            Column(Modifier.weight(1f).padding(start = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                if (subtitle.isNotBlank()) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(meta, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PersonDetailSheet(row: PersonRow, isAdmin: Boolean, onEdit: () -> Unit, onDelete: () -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(row.nama, style = MaterialTheme.typography.titleLarge)
            Text("Status Type: ${row.jenis}", style = MaterialTheme.typography.bodyMedium)
            Text("Reference ID: ${row.idLama.ifBlank { row.id }}", style = MaterialTheme.typography.bodyMedium)
            if (row.keterangan.isNotBlank()) Text("Nama Bengkel / Toko: ${row.keterangan}")
            if (row.phone.isNotBlank()) Text("No. Telepon: ${row.phone}")
            if (row.alamat.isNotBlank()) Text("Alamat: ${row.alamat}")
            Text("Limit / Saldo: ${Money.formatRupiah(row.number1)}")
            Text("Tier / Level Harga: ${row.number2.stripTrailingZeros().toPlainString()}")
            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Edit") }
                if (isAdmin) {
                    OutlinedButton(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    ) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmployeeDetailSheet(row: UserRow, isAdmin: Boolean, onEdit: () -> Unit, onDelete: () -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(row.name, style = MaterialTheme.typography.titleLarge)
            Text("@${row.username}", style = MaterialTheme.typography.bodyMedium)
            Text("Level: ${levelLabel(row.level)}")
            Text("Status Akun: ${if (row.status.equals("active", true)) "Aktif" else "Nonaktif"}")
            if (row.email.isNotBlank()) Text("Email: ${row.email}")
            if (row.phone.isNotBlank()) Text("No. Telepon: ${row.phone}")
            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Edit") }
                if (isAdmin) {
                    OutlinedButton(
                        onClick = onDelete,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    ) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PersonFormSheet(
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
            Text(if (draft.id == null) "Tambah Data" else "Ubah Data", style = MaterialTheme.typography.titleLarge)

            OutlinedTextField(
                value = draft.text1,
                onValueChange = { value -> onChange { it.copy(text1 = value) } },
                label = { Text("Nama Pihak (Lengkap) *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("person_nama"),
            )
            OutlinedTextField(
                value = draft.text2,
                onValueChange = { value -> onChange { it.copy(text2 = value) } },
                label = { Text("Nama Bengkel / Toko") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Customer", "Supplier", "Mekanik").forEach { jenis ->
                    FilterChip(
                        selected = draft.jenis == jenis,
                        onClick = { onChange { it.copy(jenis = jenis) } },
                        label = { Text(jenis) },
                    )
                }
            }
            OutlinedTextField(
                value = draft.idLama,
                onValueChange = { value -> onChange { it.copy(idLama = value) } },
                label = { Text("Reference ID") },
                singleLine = true,
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
                value = draft.alamat,
                onValueChange = { value -> onChange { it.copy(alamat = value) } },
                label = { Text("Alamat") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.number1,
                onValueChange = { value -> onChange { it.copy(number1 = value.filter { c -> c.isDigit() || c == '-' }) } },
                label = { Text("Limit / Saldo (Rp)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.number2,
                onValueChange = { value -> onChange { it.copy(number2 = value.filter(Char::isDigit)) } },
                label = { Text("Tier / Level Harga (1-5)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("person_error"))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.heightIn(min = 48.dp).testTag("person_save")) {
                    Text(if (saving) "Menyimpan..." else "Simpan")
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
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(if (draft.id == null) "Tambah Karyawan" else "Ubah Data Karyawan", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = draft.name,
                onValueChange = { value -> onChange { it.copy(name = value) } },
                label = { Text("Nama Lengkap *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("employee_nama"),
            )
            OutlinedTextField(
                value = draft.username,
                onValueChange = { value -> onChange { it.copy(username = value) } },
                label = { Text("Username *") },
                singleLine = true,
                enabled = draft.id == null,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = draft.email,
                onValueChange = { value -> onChange { it.copy(email = value) } },
                label = { Text("Email") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
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
            Text("Level", style = MaterialTheme.typography.labelLarge)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(1, 2, 5, 7, 10).forEach { level ->
                    FilterChip(
                        selected = draft.level == level,
                        onClick = { onChange { it.copy(level = level) } },
                        label = { Text("Lv-$level") },
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("active" to "Aktif", "inactive" to "Nonaktif").forEach { (value, label) ->
                    FilterChip(
                        selected = draft.status.equals(value, true),
                        onClick = { onChange { it.copy(status = value) } },
                        label = { Text(label) },
                    )
                }
            }
            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("employee_error"))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.heightIn(min = 48.dp).testTag("employee_save")) {
                    Text(if (saving) "Menyimpan..." else "Simpan")
                }
            }
        }
    }
}

private enum class LevelFilter(val value: String, val label: String) {
    ALL("all", "Semua Level"),
    ADMIN("1", "Admin"),
    STAFF("2", "Karyawan Biasa"),
    MEKANIK("10", "Mekanik"),
}

private fun levelLabel(level: Int): String = when (level) {
    1 -> "Level 1 (Super Admin)"
    2 -> "Level 2 (Admin)"
    3 -> "Level 3 (Manager)"
    4 -> "Level 4 (Supervisor)"
    5 -> "Level 5 (Kasir)"
    6 -> "Level 6 (Staff)"
    7 -> "Level 7 (Mekanik)"
    10 -> "Level 10 (Mekanik Senior)"
    else -> "Level $level"
}
