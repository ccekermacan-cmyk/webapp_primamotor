package id.primamotor.pos.ui.cashflow

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import id.primamotor.pos.data.repo.BonDraft
import id.primamotor.pos.data.repo.BonRow
import id.primamotor.pos.data.repo.CashDraft
import id.primamotor.pos.data.repo.CashflowKind
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.domain.CashflowFeed
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.WibDate
import id.primamotor.pos.ui.media.MediaImages
import id.primamotor.pos.ui.media.RemoteImage
import id.primamotor.pos.ui.media.rememberPhotoCapture
import java.math.BigDecimal
import java.time.LocalDate

private val HEADER = Color(0xFF0F172A)
private val MUTED = Color(0xFF64748B)
private val HAIRLINE = Color(0xFFE2E8F0)
private val INCOMING = Color(0xFF047857)
private val OUTGOING = Color(0xFFBE123C)
private val BLUE = Color(0xFF1D4ED8)

@Composable
private fun DialogShell(
    title: String,
    onDismiss: () -> Unit,
    tag: String,
    footer: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.fillMaxWidth(0.94f).padding(vertical = 24.dp).testTag(tag),
        ) {
            Column(Modifier.fillMaxWidth()) {
                Text(
                    title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = HEADER,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
                HorizontalDivider(color = HAIRLINE)
                Column(
                    Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) { content() }
                HorizontalDivider(color = HAIRLINE)
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) { footer() }
            }
        }
    }
}

@Composable
private fun FieldLabel(text: String, color: Color = MUTED) {
    Text(text.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = color)
}

@Composable
private fun ChipPicker(
    options: List<Pair<String, String>>,
    selected: String,
    tagPrefix: String,
    empty: String,
    onPick: (String) -> Unit,
) {
    if (options.isEmpty()) {
        Text(empty, fontSize = 11.sp, color = MUTED)
        return
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (id, label) ->
            Surface(
                color = if (id == selected) Color(0xFF0F172A) else Color(0xFFF1F5F9),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.heightIn(min = 38.dp).clickable { onPick(id) }.testTag("${tagPrefix}_$id"),
            ) {
                Text(
                    label,
                    fontSize = 11.sp,
                    color = if (id == selected) Color.White else HEADER,
                    maxLines = 1,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
                )
            }
        }
    }
}

@Composable
private fun MoneyField(value: BigDecimal, onValue: (BigDecimal) -> Unit, tag: String) {
    var text by remember(value) { mutableStateOf(if (value.signum() == 0) "" else value.toPlainString()) }
    OutlinedTextField(
        value = text,
        onValueChange = { raw ->
            text = raw.filter { it.isDigit() }
            onValue(raw.filter { it.isDigit() }.toBigDecimalOrNull() ?: BigDecimal.ZERO)
        },
        label = { Text("Nominal Rupiah", fontSize = 11.sp) },
        prefix = { Text("Rp", fontSize = 11.sp) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
    if (value.signum() > 0) {
        Text("Terbilang: ${Money.formatRupiah(value)}", fontSize = 10.sp, color = MUTED)
    }
}

/** `Catat Transaksi Kas Baru` / `Revisi Transaksi Kas`. */
@Composable
fun CashFormDialog(
    draft: CashDraft,
    accounts: List<CashflowFeed.Wallet>,
    kinds: List<CashflowKind>,
    customers: List<CashflowFeed.Wallet>,
    saving: Boolean,
    error: String?,
    edit: Boolean,
    onChange: ((CashDraft) -> CashDraft) -> Unit,
    onMutasi: (String) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val masuk = draft.mutasi.equals("Masuk", true)
    val accent = if (masuk) INCOMING else OUTGOING
    val transfer = draft.jenis.lowercase().contains("transfer")
    val bonOut = !masuk && draft.jenis.lowercase() == "bonkaryawan"
    val options = kinds.filter { it.arah == if (masuk) "in" else "out" }.ifEmpty { kinds }
    val capture = rememberPhotoCapture { path ->
        onChange { it.copy(mediaPath = path) }
    }

    DialogShell(
        title = if (edit) "Revisi Transaksi Kas" else "Catat Transaksi Kas Baru",
        onDismiss = onDismiss,
        tag = "cashflow_form",
        footer = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 44.dp)) { Text("BATALKAN", fontSize = 11.sp) }
            TextButton(
                onClick = onSave,
                enabled = !saving,
                modifier = Modifier.heightIn(min = 44.dp).testTag("cashflow_save"),
            ) {
                if (saving) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("SIMPAN", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        },
    ) {
        Row(Modifier.fillMaxWidth().background(Color(0xFFF1F5F9), RoundedCornerShape(12.dp)).padding(3.dp)) {
            MutasiButton("KAS MASUK", masuk, INCOMING, Modifier.weight(1f)) { onMutasi("Masuk") }
            MutasiButton("KAS KELUAR", !masuk, OUTGOING, Modifier.weight(1f)) { onMutasi("Keluar") }
        }

        Column {
            FieldLabel("Tanggal Waktu", accent)
            OutlinedTextField(
                value = draft.createdAtIso,
                onValueChange = { raw -> onChange { it.copy(createdAtIso = raw) } },
                placeholder = { Text("yyyy-MM-ddTHH:mm", fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("cashflow_datetime"),
            )
        }

        Column {
            FieldLabel("Jenis Cashflow", accent)
            ChipPicker(
                options = options.map { (it.idLama.ifBlank { it.id }) to it.nama },
                selected = draft.jenis,
                tagPrefix = "cashflow_form_jenis",
                empty = "Belum ada jenis cashflow.",
            ) { key -> onChange { it.copy(jenis = key) } }
        }

        Column {
            FieldLabel("Akun Sumber", accent)
            val balance = accounts.firstOrNull { it.id == draft.accountId }?.balance
            if (balance != null) Text("Saldo: ${Money.formatRupiah(balance)}", fontSize = 10.sp, color = MUTED)
            ChipPicker(
                options = accounts.map { it.id to it.name },
                selected = draft.accountId,
                tagPrefix = "cashflow_form_account",
                empty = "Belum ada akun kas.",
            ) { id -> onChange { it.copy(accountId = id) } }
        }

        if (transfer) {
            Column {
                FieldLabel("Akun Tujuan", BLUE)
                val balance = accounts.firstOrNull { it.id == draft.account2Id }?.balance
                if (balance != null) Text("Saldo: ${Money.formatRupiah(balance)}", fontSize = 10.sp, color = MUTED)
                ChipPicker(
                    options = accounts.map { it.id to it.name },
                    selected = draft.account2Id,
                    tagPrefix = "cashflow_form_account2",
                    empty = "Belum ada akun kas.",
                ) { id -> onChange { it.copy(account2Id = id) } }
            }
        }

        if (bonOut) {
            Column {
                FieldLabel("Pilih Pihak (Customer / Karyawan)", accent)
                ChipPicker(
                    options = customers.map { it.id to it.name },
                    selected = draft.personId,
                    tagPrefix = "cashflow_form_person",
                    empty = "Belum ada customer atau karyawan.",
                ) { id ->
                    val wallet = customers.firstOrNull { it.id == id }
                    onChange {
                        it.copy(
                            personId = id,
                            personText = wallet?.name.orEmpty(),
                            personUserId = if (wallet?.kind == CashflowFeed.WalletKind.KARYAWAN) wallet.id else "",
                        )
                    }
                }
                if (draft.personId.isNotBlank()) {
                    Text("Dipilih: ${draft.personText}", fontSize = 10.sp, color = INCOMING)
                }
            }
        }

        MoneyField(draft.nominal, { value -> onChange { it.copy(nominal = value) } }, "cashflow_nominal")

        Column {
            FieldLabel("Catatan", accent)
            OutlinedTextField(
                value = draft.note,
                onValueChange = { raw -> onChange { it.copy(note = raw) } },
                placeholder = { Text("Deskripsi/Catatan...", fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("cashflow_note"),
            )
        }

        Column {
            FieldLabel("Lampiran Bukti", accent)
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = capture, modifier = Modifier.heightIn(min = 44.dp)) { Text("+ FOTO BUKTI", fontSize = 10.sp) }
                draft.mediaPath?.let { path ->
                    Text("Terlampir", fontSize = 10.sp, color = MUTED, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    TextButton(onClick = { onChange { it.copy(mediaPath = null) } }) { Text("X", fontSize = 10.sp) }
                }
            }
            if (draft.mediaPath == null) Text("Belum ada file terlampir", fontSize = 10.sp, color = MUTED)
        }

        error?.let { Text(it, fontSize = 11.sp, color = OUTGOING) }
    }
}

@Composable
private fun MutasiButton(label: String, active: Boolean, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        color = if (active) color else Color.Transparent,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.heightIn(min = 42.dp).clickable(onClick = onClick),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = if (active) Color.White else MUTED,
            )
        }
    }
}

/** `Tambah Bon Karyawan`. */
@Composable
fun BonFormDialog(
    draft: BonDraft,
    accounts: List<CashflowFeed.Wallet>,
    employees: List<CashflowFeed.Wallet>,
    saving: Boolean,
    error: String?,
    allowCashflow: Boolean,
    onChange: ((BonDraft) -> BonDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    var search by remember { mutableStateOf("") }
    DialogShell(
        title = "Tambah Bon Karyawan",
        onDismiss = onDismiss,
        tag = "cashflow_bon_form",
        footer = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 44.dp)) { Text("BATALKAN", fontSize = 11.sp) }
            TextButton(
                onClick = onSave,
                enabled = !saving,
                modifier = Modifier.heightIn(min = 44.dp).testTag("cashflow_bon_save"),
            ) {
                if (saving) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("SIMPAN TRANSAKSI BON", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        },
    ) {
        if (allowCashflow) {
            Surface(color = Color(0xFFF5F3FF), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = draft.catatCashflow,
                        onCheckedChange = { checked -> onChange { it.copy(catatCashflow = checked) } },
                        modifier = Modifier.testTag("cashflow_bon_check"),
                    )
                    Column {
                        Text("Catat ke Cashflow", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6D28D9))
                        Text("Nominal bon akan tercatat sebagai pengeluaran kas", fontSize = 9.sp, color = Color(0xFF7C3AED))
                    }
                }
            }
        }

        Column {
            FieldLabel("Pilih Karyawan (User)")
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Cari nama...", fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("cashflow_bon_search"),
            )
            ChipPicker(
                options = employees.filter { it.name.contains(search, true) }.map { it.id to it.name },
                selected = draft.personUserId,
                tagPrefix = "cashflow_bon_person",
                empty = "Belum ada karyawan aktif.",
            ) { id ->
                val wallet = employees.firstOrNull { it.id == id }
                onChange { it.copy(personUserId = id, personRecordId = "", personText = wallet?.name.orEmpty()) }
            }
        }

        if (draft.catatCashflow) {
            Column {
                FieldLabel("Akun Asal (Kas)")
                ChipPicker(
                    options = accounts.map { it.id to it.name },
                    selected = draft.accountId,
                    tagPrefix = "cashflow_bon_account",
                    empty = "Belum ada akun kas.",
                ) { id -> onChange { it.copy(accountId = id) } }
            }
        }

        MoneyField(draft.nominal, { value -> onChange { it.copy(nominal = value) } }, "cashflow_bon_nominal")

        Column {
            FieldLabel("Catatan / Keterangan")
            OutlinedTextField(
                value = draft.note,
                onValueChange = { raw -> onChange { it.copy(note = raw) } },
                placeholder = { Text("Catatan bon...", fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("cashflow_bon_note"),
            )
        }

        error?.let { Text(it, fontSize = 11.sp, color = OUTGOING) }
    }
}

/** `Detail Log Transaksi Kas`. */
@Composable
fun CashflowDetailDialog(
    row: CashflowRow,
    wallets: List<CashflowFeed.Wallet>,
    showSaldo: Boolean,
    canDelete: Boolean,
    token: String?,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    val masuk = CashflowFeed.isMasuk(row)
    val transfer = CashflowFeed.isTransfer(row)
    val accent = when {
        transfer -> BLUE
        masuk -> INCOMING
        else -> OUTGOING
    }
    DialogShell(
        title = "Detail Log Transaksi Kas",
        onDismiss = onDismiss,
        tag = "cashflow_detail",
        footer = {
            if (canDelete) {
                TextButton(onClick = onDelete, modifier = Modifier.heightIn(min = 44.dp).testTag("cashflow_detail_delete")) {
                    Text("HAPUS", fontSize = 11.sp, color = OUTGOING)
                }
            }
            TextButton(onClick = onEdit, modifier = Modifier.heightIn(min = 44.dp).testTag("cashflow_detail_edit")) {
                Text("Edit Transaksi", fontSize = 11.sp)
            }
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 44.dp)) { Text("TUTUP DETAIL", fontSize = 11.sp) }
        },
    ) {
        Surface(color = accent, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    if (transfer) "TRANSFER" else if (masuk) "KAS MASUK" else "KAS KELUAR",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White.copy(alpha = 0.7f),
                )
                Text(
                    "${CashflowFeed.sign(row)} ${Money.formatRupiah(row.nominal.abs())}",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                )
                Text(row.jenis.ifBlank { "-" }, fontSize = 11.sp, color = Color.White)
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    MiniFact("ID", CashflowFeed.shortCode(row))
                    MiniFact("WAKTU", CashflowFeed.dateTime(row.createdAt))
                    MiniFact("OPERATOR", row.operator.ifBlank { "-" })
                }
            }
        }

        DetailLine("Waktu Transaksi", CashflowFeed.dateTime(row.createdAt))
        DetailLine("Operator", row.operator.ifBlank { "-" })
        if (row.ref.isNotBlank()) DetailLine("Ref Transaksi POS", row.ref)
        DetailLine("Jenis", row.jenis.ifBlank { "-" })
        DetailLine("Akun Sumber", CashflowFeed.accountName(wallets.firstOrNull { it.id == row.account1 || it.idLama == row.acc1 }, row.account1))
        if (transfer || row.account2.isNotBlank()) {
            DetailLine("Akun Tujuan", CashflowFeed.accountName(wallets.firstOrNull { it.id == row.account2 || it.idLama == row.acc2 }, row.account2))
        }
        if (row.persontext.isNotBlank() || row.person.isNotBlank()) {
            DetailLine("Pihak", CashflowFeed.personName(row.person, row.persontext, wallets))
        }
        if (showSaldo) {
            DetailLine("Saldo Sebelum Transaksi", CashflowViewModel.rupiah(row.saldoAwal))
            DetailLine("Saldo Sesudah Transaksi", CashflowViewModel.rupiah(row.saldoAkhir))
        }

        Column {
            FieldLabel("Catatan & Keterangan")
            Text(row.note.ifBlank { "-" }, fontSize = 12.sp, color = HEADER)
        }

        if (row.files.isNotEmpty() && token != null) {
            Column {
                FieldLabel("Bukti Lampiran Media")
                row.files.forEach { name ->
                    RemoteImage(
                        url = MediaImages.url("cashflow", row.id, name, "400x400"),
                        token = token,
                        contentDescription = name,
                        placeholder = "Bukti",
                        modifier = Modifier.fillMaxWidth().height(140.dp).padding(vertical = 2.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniFact(label: String, value: String) {
    Column {
        Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.6f))
        Text(value, fontSize = 10.sp, color = Color.White, maxLines = 1)
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(label + ":", fontSize = 11.sp, color = MUTED, modifier = Modifier.weight(1f))
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = HEADER, maxLines = 2)
    }
}

/** `Riwayat Bon: {nama}`. */
@Composable
fun BonHistoryDialog(
    wallet: CashflowFeed.Wallet,
    rows: List<BonRow>,
    canDelete: Boolean,
    onDelete: (BonRow) -> Unit,
    onDismiss: () -> Unit,
) {
    DialogShell(
        title = "Riwayat Bon: ${wallet.name}",
        onDismiss = onDismiss,
        tag = "cashflow_bon_history",
        footer = { TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 44.dp)) { Text("TUTUP", fontSize = 11.sp) } },
    ) {
        Surface(color = Color(0xFFF1F5F9), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text("Total saldo bon saat ini", fontSize = 10.sp, color = MUTED)
                Text(Money.formatRupiah(wallet.balance), fontSize = 18.sp, fontWeight = FontWeight.Black, color = OUTGOING)
            }
        }
        if (rows.isEmpty()) {
            Text("Belum ada riwayat bon.", fontSize = 12.sp, color = MUTED)
        }
        rows.sortedByDescending { WibDate.parseInstant(it.created)?.toEpochMilli() ?: 0L }.forEach { row ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(CashflowFeed.dateTime(row.created), fontSize = 10.sp, color = MUTED)
                    Text(row.note.ifBlank { "-" }, fontSize = 11.sp, color = HEADER, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Text(
                    (if (row.jenis == "in") "+ " else "- ") + Money.formatRupiah(row.nominal.abs()),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (row.jenis == "in") INCOMING else OUTGOING,
                )
                if (canDelete && row.refGaji.isBlank()) {
                    TextButton(
                        onClick = { onDelete(row) },
                        modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_bon_delete"),
                    ) { Text("Hapus", fontSize = 10.sp, color = OUTGOING) }
                }
            }
            HorizontalDivider(color = HAIRLINE)
        }
        Text(
            "Bon dari slip gaji hanya bisa diubah lewat transaksi gaji.",
            fontSize = 9.sp,
            color = MUTED,
        )
    }
}

/** `Filter Riwayat Kas` untuk layar sempit. */
@Composable
fun MobileFilterDialog(
    state: CashflowUiState,
    accounts: List<CashflowFeed.Wallet>,
    kinds: List<CashflowKind>,
    onMutasi: (String) -> Unit,
    onToggleAccount: (String) -> Unit,
    onToggleJenis: (String) -> Unit,
    onDates: (String, String) -> Unit,
    onSearch: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    DialogShell(
        title = "Filter Riwayat Kas",
        onDismiss = onDismiss,
        tag = "cashflow_mobile_filter_dialog",
        footer = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 44.dp)) { Text("TUTUP", fontSize = 11.sp) }
        },
    ) {
        Column {
            FieldLabel("Mutasi")
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(CashflowFeed.SEMUA, CashflowFeed.MASUK, CashflowFeed.KELUAR).forEach { value ->
                    Surface(
                        color = if (state.filter.mutasi == value) Color(0xFF0F172A) else Color(0xFFF1F5F9),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.heightIn(min = 38.dp).clickable { onMutasi(value) },
                    ) {
                        Text(
                            value,
                            fontSize = 11.sp,
                            color = if (state.filter.mutasi == value) Color.White else HEADER,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
                        )
                    }
                }
            }
        }
        Column {
            FieldLabel("Akun")
            ChipPicker(
                options = accounts.map { it.id to it.name },
                selected = state.filter.accountIds.singleOrNull().orEmpty(),
                tagPrefix = "cashflow_mobile_account",
                empty = "Belum ada akun kas.",
            ) { id -> onToggleAccount(id) }
        }
        Column {
            FieldLabel("Jenis")
            ChipPicker(
                options = kinds.map { (it.idLama.ifBlank { it.id }) to it.nama },
                selected = state.filter.jenisKeys.singleOrNull().orEmpty(),
                tagPrefix = "cashflow_mobile_jenis",
                empty = "Belum ada jenis cashflow.",
            ) { key -> onToggleJenis(key) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = state.filter.from,
                onValueChange = { onDates(it, state.filter.to) },
                label = { Text("Dari", fontSize = 10.sp) },
                placeholder = { Text("YYYY-MM-DD", fontSize = 10.sp) },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("cashflow_mobile_from"),
            )
            OutlinedTextField(
                value = state.filter.to,
                onValueChange = { onDates(state.filter.from, it) },
                label = { Text("Sampai", fontSize = 10.sp) },
                placeholder = { Text("YYYY-MM-DD", fontSize = 10.sp) },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("cashflow_mobile_to"),
            )
        }
        OutlinedTextField(
            value = state.searchInput,
            onValueChange = onSearch,
            label = { Text("Cari", fontSize = 10.sp) },
            placeholder = { Text("Nota/Ket...", fontSize = 10.sp) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("cashflow_mobile_search"),
        )
    }
}
