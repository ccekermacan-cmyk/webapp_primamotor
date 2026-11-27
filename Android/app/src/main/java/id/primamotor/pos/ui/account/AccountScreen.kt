package id.primamotor.pos.ui.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.TextButton
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.BonRow
import id.primamotor.pos.data.repo.GajiRow
import id.primamotor.pos.domain.LoanEntry
import id.primamotor.pos.domain.LoanSummary
import id.primamotor.pos.domain.Money
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

data class AccountUiState(
    val profileOpen: Boolean = false,
    val profileName: String = "",
    val linkImage: String = "",
    val changePasswordInline: Boolean = false,
    val passwordOpen: Boolean = false,
    val emailOpen: Boolean = false,
    val slipFor: GajiRow? = null,
    val oldPassword: String = "",
    val password: String = "",
    val passwordConfirm: String = "",
    val newEmail: String = "",
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

class AccountViewModel(private val container: AppContainer) : ViewModel() {
    private val user = container.tokenStore.cachedUser()
    var nama: String = user?.name.orEmpty().ifBlank { user?.username.orEmpty() }
        private set
    val username: String = user?.username.orEmpty()
    private val userId: String = user?.id.orEmpty()

    /** Gaji hanya milik pengguna login; baris lain tidak pernah dipancarkan. */
    val gaji = container.repositories.observeGajiSendiri(username)
    val bon = container.repositories.observeBon(user?.id.orEmpty())

    private val local = MutableStateFlow(AccountUiState())
    val state: StateFlow<AccountUiState> = local

    fun openProfile() = local.update {
        it.copy(
            profileOpen = true,
            profileName = nama,
            linkImage = "",
            changePasswordInline = false,
            oldPassword = "",
            password = "",
            passwordConfirm = "",
            error = null,
        )
    }

    /** Simpan profil: nama wajib, avatar opsional, password opsional (butuh jaringan). */
    fun saveProfile() {
        val snapshot = local.value
        val name = snapshot.profileName.trim()
        if (name.isEmpty()) {
            local.update { it.copy(error = "Nama wajib diisi.") }
            return
        }
        if (snapshot.changePasswordInline) {
            if (snapshot.password != snapshot.passwordConfirm) {
                local.update { it.copy(error = "Konfirmasi password tidak sama.") }
                return
            }
            if (snapshot.password.isNotEmpty() && snapshot.password.length < 8) {
                local.update { it.copy(error = "Password minimal 8 karakter.") }
                return
            }
        }
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val newPassword = if (snapshot.changePasswordInline && snapshot.password.isNotEmpty()) snapshot.password else null
            runCatching {
                container.sessions.updateProfile(
                    userId = userId,
                    name = name,
                    linkImage = snapshot.linkImage.trim(),
                    oldPassword = if (newPassword != null) snapshot.oldPassword else null,
                    password = newPassword,
                )
            }.onSuccess {
                nama = name
                local.update {
                    it.copy(
                        saving = false,
                        profileOpen = false,
                        changePasswordInline = false,
                        oldPassword = "",
                        password = "",
                        passwordConfirm = "",
                        message = "Profil berhasil diperbarui.",
                    )
                }
            }.onFailure { error ->
                local.update { it.copy(saving = false, error = error.message ?: "Gagal memperbarui profil. Periksa koneksi.") }
            }
        }
    }

    fun openPassword() = local.update { it.copy(passwordOpen = true, error = null) }
    fun openEmail() = local.update { it.copy(emailOpen = true, error = null) }
    fun showSlip(row: GajiRow) = local.update { it.copy(slipFor = row) }
    fun closeSlip() = local.update { it.copy(slipFor = null) }
    fun closeForms() = local.update {
        it.copy(profileOpen = false, passwordOpen = false, emailOpen = false, error = null)
    }
    fun update(block: (AccountUiState) -> AccountUiState) = local.update(block)
    fun clearMessage() = local.update { it.copy(message = null) }

    /** Ubah password wajib online; server memverifikasi password lama. */
    fun changePassword() {
        val snapshot = local.value
        if (snapshot.password != snapshot.passwordConfirm) {
            local.update { it.copy(error = "Konfirmasi password tidak sama.") }
            return
        }
        if (snapshot.password.length < 8) {
            local.update { it.copy(error = "Password minimal 8 karakter.") }
            return
        }
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching {
                container.sessions.changePassword(userId, snapshot.oldPassword, snapshot.password)
            }.onSuccess {
                local.update {
                    it.copy(saving = false, passwordOpen = false, password = "", passwordConfirm = "", oldPassword = "", message = "Password berhasil diubah.")
                }
            }.onFailure { error ->
                local.update { it.copy(saving = false, error = error.message ?: "Gagal mengubah password. Periksa koneksi.") }
            }
        }
    }

    fun requestEmailChange() {
        val snapshot = local.value
        val email = snapshot.newEmail.trim()
        if (!email.contains("@") || !email.contains(".")) {
            local.update { it.copy(error = "Email baru tidak valid.") }
            return
        }
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching {
                container.sessions.requestEmailChange(email)
            }.onSuccess {
                local.update { it.copy(saving = false, emailOpen = false, newEmail = "", message = "Tautan konfirmasi dikirim ke email baru.") }
            }.onFailure { error ->
                local.update { it.copy(saving = false, error = error.message ?: "Gagal meminta perubahan email. Periksa koneksi.") }
            }
        }
    }
}

@Composable
fun AccountRoute(container: AppContainer, onLogout: () -> Unit) {
    val vm: AccountViewModel = viewModel { AccountViewModel(container) }
    AccountScreen(vm, container, onLogout)
}

@Composable
fun AccountScreen(viewModel: AccountViewModel, container: AppContainer, onLogout: () -> Unit) {
    val gaji by viewModel.gaji.collectAsStateWithLifecycle(emptyList())
    val bon by viewModel.bon.collectAsStateWithLifecycle(emptyList())
    val state by viewModel.state.collectAsStateWithLifecycle()
    var page by remember { mutableStateOf(1) }
    var bonPage by remember { mutableStateOf(1) }
    var hideNominal by remember { mutableStateOf(true) }
    var verifyOpen by remember { mutableStateOf(false) }
    var verifyPass by remember { mutableStateOf("") }
    var verifyError by remember { mutableStateOf<String?>(null) }
    var verifying by remember { mutableStateOf(false) }
    var pendingSlip by remember { mutableStateOf<GajiRow?>(null) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val perPage = 5
    val totalPages = maxOf(1, (gaji.size + perPage - 1) / perPage)
    val safePage = page.coerceIn(1, totalPages)
    val salaryPage = gaji.drop((safePage - 1) * perPage).take(perPage)
    val bonTotalPages = maxOf(1, (bon.size + perPage - 1) / perPage)
    val safeBonPage = bonPage.coerceIn(1, bonTotalPages)
    val bonPageRows = bon.drop((safeBonPage - 1) * perPage).take(perPage)
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.clearMessage() }
    }
    val loans = LoanSummary.of(bon.map(BonAdapter::toEntry), gaji.firstOrNull()?.diterima ?: java.math.BigDecimal.ZERO)

    androidx.compose.material3.Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { padding ->
    Column(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(56.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(18.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        viewModel.nama.trim().take(2).uppercase().ifBlank { "AK" },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Column(Modifier.weight(1f).padding(start = 14.dp)) {
                    Text(viewModel.nama.ifBlank { "Akun" }, style = MaterialTheme.typography.titleLarge)
                    Text(viewModel.username, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = viewModel::openProfile, modifier = Modifier.weight(1f).heightIn(min = 44.dp)) {
                    Text("Update Profil")
                }
                OutlinedButton(onClick = viewModel::openEmail, modifier = Modifier.weight(1f).heightIn(min = 44.dp)) {
                    Text("Ubah Email")
                }
            }
        }

        Text("Gaji saya", style = MaterialTheme.typography.titleMedium)
        if (gaji.isEmpty()) {
            Text("Belum ada data gaji di cache. Data muncul setelah sinkron berhasil.", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn(Modifier.weight(1f)) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        OutlinedButton(
                            onClick = {
                                if (hideNominal) {
                                    pendingSlip = null
                                    verifyPass = ""
                                    verifyError = null
                                    verifyOpen = true
                                } else {
                                    hideNominal = true
                                }
                            },
                            modifier = Modifier.heightIn(min = 40.dp),
                        ) {
                            Text(if (hideNominal) "Tampilkan nominal" else "Sembunyikan nominal")
                        }
                    }
                }
                items(salaryPage, key = { it.id }) { row ->
                    Column(
                        Modifier.clickable {
                            if (hideNominal) {
                                pendingSlip = row
                                verifyPass = ""
                                verifyError = null
                                verifyOpen = true
                            } else {
                                viewModel.showSlip(row)
                            }
                        },
                    ) { GajiRowItem(row, hideNominal) }
                }
                item {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedButton(onClick = { if (safePage > 1) page = safePage - 1 }, enabled = safePage > 1) { Text("Sebelumnya") }
                        Text("Gaji $safePage / $totalPages", style = MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick = { if (safePage < totalPages) page = safePage + 1 }, enabled = safePage < totalPages) { Text("Berikutnya") }
                    }
                    Text("Bon", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                    Text(
                        "Dipinjam ${mask(hideNominal, loans.borrowed)} • dibayar ${mask(hideNominal, loans.repaid)}" +
                            (if (hideNominal) " • •••" else loans.rate?.let { " • $it%" } ?: ""),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    bonPageRows.forEach { bonRow -> BonItem(bonRow, hideNominal) }
                    if (bon.isNotEmpty()) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            OutlinedButton(onClick = { if (safeBonPage > 1) bonPage = safeBonPage - 1 }, enabled = safeBonPage > 1) { Text("Sebelumnya") }
                            Text("Bon $safeBonPage / $bonTotalPages", style = MaterialTheme.typography.bodySmall)
                            OutlinedButton(onClick = { if (safeBonPage < bonTotalPages) bonPage = safeBonPage + 1 }, enabled = safeBonPage < bonTotalPages) { Text("Berikutnya") }
                        }
                    }
                }
            }
        }

        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("logout"),
        ) { Text("Keluar") }
    }
    }

    if (state.profileOpen) {
        AlertDialog(
            onDismissRequest = viewModel::closeForms,
            title = { Text("Update Profil") },
            text = {
                Column(
                    Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(
                        value = state.profileName,
                        onValueChange = { value -> viewModel.update { it.copy(profileName = value) } },
                        label = { Text("Nama lengkap") },
                        singleLine = true,
                        modifier = Modifier.testTag("profile_name"),
                    )
                    OutlinedTextField(
                        value = viewModel.username,
                        onValueChange = {},
                        label = { Text("Username") },
                        enabled = false,
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = state.linkImage,
                        onValueChange = { value -> viewModel.update { it.copy(linkImage = value) } },
                        label = { Text("URL avatar (opsional)") },
                        singleLine = true,
                        modifier = Modifier.testTag("profile_image"),
                    )
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            viewModel.update { it.copy(changePasswordInline = !it.changePasswordInline) }
                        },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = state.changePasswordInline,
                            onCheckedChange = { value -> viewModel.update { it.copy(changePasswordInline = value) } },
                        )
                        Text("Ganti password (opsional)", style = MaterialTheme.typography.bodyMedium)
                    }
                    if (state.changePasswordInline) {
                        OutlinedTextField(
                            value = state.oldPassword,
                            onValueChange = { value -> viewModel.update { it.copy(oldPassword = value) } },
                            label = { Text("Password saat ini") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                        )
                        OutlinedTextField(
                            value = state.password,
                            onValueChange = { value -> viewModel.update { it.copy(password = value) } },
                            label = { Text("Password baru (min 8)") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                        )
                        OutlinedTextField(
                            value = state.passwordConfirm,
                            onValueChange = { value -> viewModel.update { it.copy(passwordConfirm = value) } },
                            label = { Text("Ulangi password baru") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                        )
                    }
                    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Text("Butuh jaringan. Avatar hanya tersimpan sebagai URL.", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::saveProfile, enabled = !state.saving) {
                    Text(if (state.saving) "Menyimpan..." else "Simpan Perubahan")
                }
            },
            dismissButton = { TextButton(onClick = viewModel::closeForms) { Text("Batal") } },
        )
    }

    if (state.passwordOpen) {
        AlertDialog(
            onDismissRequest = viewModel::closeForms,
            title = { Text("Ubah Password") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = state.oldPassword,
                        onValueChange = { value -> viewModel.update { it.copy(oldPassword = value) } },
                        label = { Text("Password lama") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.testTag("old_password"),
                    )
                    OutlinedTextField(
                        value = state.password,
                        onValueChange = { value -> viewModel.update { it.copy(password = value) } },
                        label = { Text("Password baru (min 8)") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.testTag("new_password"),
                    )
                    OutlinedTextField(
                        value = state.passwordConfirm,
                        onValueChange = { value -> viewModel.update { it.copy(passwordConfirm = value) } },
                        label = { Text("Ulangi password baru") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.testTag("confirm_password"),
                    )
                    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Text("Butuh jaringan. Password lama diverifikasi server.", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::changePassword, enabled = !state.saving) {
                    Text(if (state.saving) "Menyimpan..." else "Simpan")
                }
            },
            dismissButton = { TextButton(onClick = viewModel::closeForms) { Text("Batal") } },
        )
    }

    if (state.emailOpen) {
        AlertDialog(
            onDismissRequest = viewModel::closeForms,
            title = { Text("Ubah Email") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = state.newEmail,
                        onValueChange = { value -> viewModel.update { it.copy(newEmail = value) } },
                        label = { Text("Email baru") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.testTag("new_email"),
                    )
                    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Text("PocketBase mengirim tautan konfirmasi ke email baru.", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::requestEmailChange, enabled = !state.saving) {
                    Text(if (state.saving) "Mengirim..." else "Kirim")
                }
            },
            dismissButton = { TextButton(onClick = viewModel::closeForms) { Text("Batal") } },
        )
    }

    if (verifyOpen) {
        AlertDialog(
            onDismissRequest = { if (!verifying) { verifyOpen = false; pendingSlip = null } },
            title = { Text("Verifikasi Akses Privasi") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Masukkan password akun untuk membuka nominal gaji & bon.", style = MaterialTheme.typography.bodySmall)
                    OutlinedTextField(
                        value = verifyPass,
                        onValueChange = { verifyPass = it; verifyError = null },
                        label = { Text("Password login") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.testTag("verify_password"),
                    )
                    verifyError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Text("Butuh jaringan. Password diverifikasi server.", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !verifying,
                    onClick = {
                        if (verifying) return@TextButton
                        verifying = true
                        verifyError = null
                        scope.launch {
                            val ok = runCatching {
                                container.sessions.verifyPassword(viewModel.username, verifyPass)
                            }.getOrDefault(false)
                            verifying = false
                            if (ok) {
                                hideNominal = false
                                verifyOpen = false
                                verifyPass = ""
                                pendingSlip?.let { viewModel.showSlip(it) }
                                pendingSlip = null
                            } else {
                                verifyError = "Password salah! Akses ditolak."
                            }
                        }
                    },
                ) { Text(if (verifying) "Memeriksa..." else "Buka Privasi") }
            },
            dismissButton = { TextButton(onClick = { verifyOpen = false; pendingSlip = null }) { Text("Batal") } },
        )
    }

    state.slipFor?.let { row -> SlipDialog(row, viewModel::closeSlip) }
}

@Composable
private fun GajiRowItem(row: GajiRow, hideNominal: Boolean = true) {
    fun amount(value: BigDecimal) = if (hideNominal) "Rp ****" else Money.formatRupiah(value)
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(row.ref.ifBlank { row.id }, style = MaterialTheme.typography.bodySmall)
            Text(amount(row.diterima), fontWeight = FontWeight.SemiBold)
        }
        Text(
            "Pokok ${amount(row.pokok)} • lembur ${amount(row.lembur)} • bpjs ${amount(row.bpjs)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    HorizontalDivider()
}

@Composable
private fun BonItem(row: BonRow, hideNominal: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(if (row.jenis == "out") "Pinjam" else "Bayar", style = MaterialTheme.typography.bodySmall)
        Text(mask(hideNominal, row.nominal), style = MaterialTheme.typography.bodySmall)
    }
}

private fun mask(hidden: Boolean, value: BigDecimal): String =
    if (hidden) "Rp ****" else Money.formatRupiah(value)

object BonAdapter {
    fun toEntry(row: BonRow) = LoanEntry(row.nominal, row.jenis)
}
@Composable
private fun SlipDialog(row: GajiRow, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rincian Gaji") },
        text = {
            Column(
                Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                SlipLine("Referensi", row.ref.ifBlank { row.id })
                SlipLine("Tanggal", row.createdAt)
                HorizontalDivider()
                SlipLine("Gaji pokok", Money.formatRupiah(row.pokok))
                SlipLine("Tunjangan", Money.formatRupiah(row.tunjangan))
                SlipLine("Lembur", Money.formatRupiah(row.lembur))
                SlipLine("Bonus", Money.formatRupiah(row.bonus))
                SlipLine("Qty", row.qty.stripTrailingZeros().toPlainString())
                SlipLine("Alfa", Money.formatRupiah(row.alfa))
                SlipLine("Setengah hari", Money.formatRupiah(row.setengahHari))
                SlipLine("Sakit", Money.formatRupiah(row.sakit))
                SlipLine("Telat", Money.formatRupiah(row.telat))
                SlipLine("BPJS", Money.formatRupiah(row.bpjs))
                SlipLine("Bon diambil", Money.formatRupiah(row.bonDiambil))
                SlipLine("Bon dibayar", Money.formatRupiah(row.bonDibayar))
                HorizontalDivider()
                SlipLine("Diterima", Money.formatRupiah(row.diterima))
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Tutup") } },
    )
}

@Composable
private fun SlipLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall)
    }
}
