package id.primamotor.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosFeed
import id.primamotor.pos.domain.PosPricing
import id.primamotor.pos.ui.media.rememberPhotoCapture
import java.math.BigDecimal
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutSheet(
    state: PosUiState,
    customers: List<PersonRow>,
    accounts: List<PersonRow>,
    mechanics: List<UserRow>,
    onQty: (String, BigDecimal) -> Unit,
    onRemove: (String) -> Unit,
    onManualPrice: (String, BigDecimal?) -> Unit,
    onDraft: ((CheckoutDraft) -> CheckoutDraft) -> Unit,
    onCustomer: (PersonRow) -> Unit,
    onAddPayment: () -> Unit,
    onRemovePayment: (Int) -> Unit,
    onUpdatePayment: (Int, (PaymentLine) -> PaymentLine) -> Unit,
    onAddMechanic: () -> Unit,
    onRemoveMechanic: (Int) -> Unit,
    onUpdateMechanic: (Int, (MechanicLine) -> MechanicLine) -> Unit,
    onSubmit: () -> Unit,
    onCancelEdit: () -> Unit,
    onDismiss: () -> Unit,
    onTab: (Int) -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            CheckoutContent(
                state = state,
                customers = customers,
                accounts = accounts,
                mechanics = mechanics,
                onQty = onQty,
                onRemove = onRemove,
                onManualPrice = onManualPrice,
                onDraft = onDraft,
                onCustomer = onCustomer,
                onAddPayment = onAddPayment,
                onRemovePayment = onRemovePayment,
                onUpdatePayment = onUpdatePayment,
                onAddMechanic = onAddMechanic,
                onRemoveMechanic = onRemoveMechanic,
                onUpdateMechanic = onUpdateMechanic,
                onSubmit = onSubmit,
                onCancelEdit = onCancelEdit,
                onTab = onTab,
            )
        }
    }
}

/** Isi keranjang dipakai di bottom sheet (HP) dan panel kanan (tablet/lanskap). */
@Composable
fun CheckoutContent(
    state: PosUiState,
    customers: List<PersonRow>,
    accounts: List<PersonRow>,
    mechanics: List<UserRow>,
    onQty: (String, BigDecimal) -> Unit,
    onRemove: (String) -> Unit,
    onManualPrice: (String, BigDecimal?) -> Unit,
    onDraft: ((CheckoutDraft) -> CheckoutDraft) -> Unit,
    onCustomer: (PersonRow) -> Unit,
    onAddPayment: () -> Unit,
    onRemovePayment: (Int) -> Unit,
    onUpdatePayment: (Int, (PaymentLine) -> PaymentLine) -> Unit,
    onAddMechanic: () -> Unit,
    onRemoveMechanic: (Int) -> Unit,
    onUpdateMechanic: (Int, (MechanicLine) -> MechanicLine) -> Unit,
    onSubmit: () -> Unit,
    onCancelEdit: () -> Unit,
    onTab: (Int) -> Unit,
) {
    val service = PosPricing.isService(state.draft.menu)
    val tab = state.cartTab.coerceIn(0, 2)
    var priceTarget by remember { mutableStateOf<Produk?>(null) }
    val captureProof = rememberPhotoCapture { path ->
        onDraft { it.copy(mediaPath = path, mediaCount = it.mediaCount + 1) }
    }

    Text(
        if (state.edit != null) {
            "Transaksi ${state.draft.menu} · Edit ${state.edit?.menuId?.take(8)}"
        } else {
            "Transaksi ${state.draft.menu}"
        },
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold,
    )

    TabRow(selectedTabIndex = tab, modifier = Modifier.fillMaxWidth()) {
        listOf("Barang & jasa", "Pembayaran", "Catatan").forEachIndexed { index, label ->
            Tab(
                selected = tab == index,
                onClick = { onTab(index) },
                text = { Text(label, style = MaterialTheme.typography.labelLarge) },
                modifier = Modifier.heightIn(min = 44.dp).testTag("checkout_tab_$index"),
            )
        }
    }

    if (tab == 0) {
        ItemsTab(
            state = state,
            customers = customers,
            mechanics = mechanics,
            service = service,
            onQty = onQty,
            onRemove = onRemove,
            onCustomer = onCustomer,
            onAddMechanic = onAddMechanic,
            onRemoveMechanic = onRemoveMechanic,
            onUpdateMechanic = onUpdateMechanic,
            onPrice = { priceTarget = it },
        )
    }

    if (tab == 1) {
        PaymentTab(
            state = state,
            accounts = accounts,
            onDraft = onDraft,
            onAddPayment = onAddPayment,
            onRemovePayment = onRemovePayment,
            onUpdatePayment = onUpdatePayment,
        )
    }

    if (tab == 2) {
        NotesTab(state = state, onDraft = onDraft, onCaptureProof = captureProof)
    }

    HorizontalDivider()

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Subtotal")
        Text(Money.formatRupiah(state.subtotal))
    }
    if (service && state.ongkosTotal.signum() > 0) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Ongkos mekanik")
            Text(Money.formatRupiah(state.ongkosTotal))
        }
    }
    if (state.isOnline) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Admin fee (-) / Cashback (+)")
            Text(
                "${Money.formatRupiah(Money.parse(state.draft.adminFee))} / " +
                    Money.formatRupiah(Money.parse(state.draft.cashback)),
            )
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Total", style = MaterialTheme.typography.titleMedium)
        Text(
            Money.formatRupiah(state.total),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.testTag("checkout_total"),
        )
    }

    if (state.error != null) {
        Text(
            state.error,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("checkout_error"),
        )
    }

    if (state.edit != null) {
        Text(
            "Menyimpan akan menimpa nota lama; tanggal nota tidak berubah.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(onClick = onCancelEdit, modifier = Modifier.heightIn(min = 44.dp)) {
            Text("Batal edit")
        }
    }

    Button(
        onClick = onSubmit,
        enabled = !state.saving && (state.cart.isNotEmpty() || service),
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("checkout_submit"),
    ) {
        Text(
            when {
                state.saving -> "Menyimpan..."
                else -> "Periksa transaksi"
            },
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
    }

    priceTarget?.let { product ->
        PriceDialog(
            product = product,
            current = state.lines.firstOrNull { it.produk.id == product.id }?.price,
            onConfirm = { price ->
                onManualPrice(product.id, price)
                priceTarget = null
            },
            onReset = {
                onManualPrice(product.id, null)
                priceTarget = null
            },
            onDismiss = { priceTarget = null },
        )
    }
}

@Composable
private fun ItemsTab(
    state: PosUiState,
    customers: List<PersonRow>,
    mechanics: List<UserRow>,
    service: Boolean,
    onQty: (String, BigDecimal) -> Unit,
    onRemove: (String) -> Unit,
    onCustomer: (PersonRow) -> Unit,
    onAddMechanic: () -> Unit,
    onRemoveMechanic: (Int) -> Unit,
    onUpdateMechanic: (Int, (MechanicLine) -> MechanicLine) -> Unit,
    onPrice: (Produk) -> Unit,
) {
    if (state.edit != null) {
        Text(
            "Mode edit nota aktif. Jumlah, pelanggan, dan rincian lain bisa diubah.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary,
        )
    }

    if (state.cart.isEmpty()) {
        Text(
            if (service) {
                "Tidak ada sparepart/item fisik. Hanya mencatat nota jasa service."
            } else {
                "Keranjang kosong. Ketuk produk untuk menambah."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    state.lines.forEach { line ->
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.weight(1f)) {
                Text(PosFeed.productLabel(line.produk))
                Text(
                    "${Money.formatRupiah(line.price)} x ${line.qty.stripTrailingZeros().toPlainString()}" +
                        (if (line.tiered) " • ${line.label}" else ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (line.tiered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = { onPrice(line.produk) }, modifier = Modifier.heightIn(min = 36.dp)) {
                    Text("Ubah harga", style = MaterialTheme.typography.labelSmall)
                }
            }
            TextButton(onClick = { onQty(line.produk.id, line.qty - BigDecimal.ONE) }) { Text("-") }
            Text(line.qty.stripTrailingZeros().toPlainString())
            TextButton(onClick = { onQty(line.produk.id, line.qty + BigDecimal.ONE) }) { Text("+") }
            TextButton(onClick = { onRemove(line.produk.id) }) { Text("Hapus") }
        }
    }

    Text("Pelanggan", style = MaterialTheme.typography.labelLarge)
    Text(
        PosFeed.personLabel(state.draft.personIdLama, customers, "Pilih Pelanggan..."),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(customers, key = { it.id }) { person ->
            FilterChip(
                selected = state.draft.personIdLama == person.idLama.ifBlank { person.id },
                onClick = { onCustomer(person) },
                label = { Text(PosFeed.personLabel(person.idLama.ifBlank { person.id }, customers, person.nama)) },
                modifier = Modifier.heightIn(min = 40.dp),
            )
        }
    }

    if (service) {
        MechanicSection(
            state = state,
            mechanics = mechanics,
            onAddMechanic = onAddMechanic,
            onRemoveMechanic = onRemoveMechanic,
            onUpdateMechanic = onUpdateMechanic,
        )
    }
}

@Composable
private fun MechanicSection(
    state: PosUiState,
    mechanics: List<UserRow>,
    onAddMechanic: () -> Unit,
    onRemoveMechanic: (Int) -> Unit,
    onUpdateMechanic: (Int, (MechanicLine) -> MechanicLine) -> Unit,
) {
    Text("Alokasi Mekanik & Ongkos", style = MaterialTheme.typography.labelLarge)
    state.draft.mechanics.forEachIndexed { index, line ->
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(mechanics, key = { it.id }) { mechanic ->
                    val value = mechanic.username
                    val taken = state.draft.mechanics.any { it.idLama == value && it.idLama != line.idLama }
                    FilterChip(
                        selected = line.idLama == value,
                        enabled = !taken,
                        onClick = { onUpdateMechanic(index) { it.copy(idLama = value) } },
                        label = { Text(mechanic.name.ifBlank { value }) },
                        modifier = Modifier.heightIn(min = 40.dp),
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = line.ongkos,
                    onValueChange = { raw ->
                        val parsed = Money.parse(raw)
                        onUpdateMechanic(index) { it.copy(ongkos = parsed?.stripTrailingZeros()?.toPlainString() ?: "") }
                    },
                    label = { Text("Ongkos kerja") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f).testTag("mechanic_ongkos_$index"),
                )
                if (state.draft.mechanics.size > 1) {
                    TextButton(onClick = { onRemoveMechanic(index) }) { Text("Hapus") }
                }
            }
        }
    }
    OutlinedButton(onClick = onAddMechanic, modifier = Modifier.heightIn(min = 44.dp)) {
        Text("Tambah mekanik")
    }
}

@Composable
private fun PaymentTab(
    state: PosUiState,
    accounts: List<PersonRow>,
    onDraft: ((CheckoutDraft) -> CheckoutDraft) -> Unit,
    onAddPayment: () -> Unit,
    onRemovePayment: (Int) -> Unit,
    onUpdatePayment: (Int, (PaymentLine) -> PaymentLine) -> Unit,
) {
    Text("Tipe Bayar", style = MaterialTheme.typography.labelLarge)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("Tunai", "Tempo").forEach { payment ->
            FilterChip(
                selected = state.draft.payment == payment,
                onClick = { onDraft { it.copy(payment = payment) } },
                label = { Text(if (payment == "Tunai") "CASH" else "TEMPO") },
                modifier = Modifier.heightIn(min = 44.dp).testTag("payment_$payment"),
            )
        }
    }

    Text("Akun Kas & Nominal", style = MaterialTheme.typography.labelLarge)
    state.draft.payments.forEachIndexed { index, line ->
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(accounts, key = { it.id }) { account ->
                    FilterChip(
                        selected = line.accountId == account.id,
                        onClick = { onUpdatePayment(index) { it.copy(accountId = account.id) } },
                        label = { Text(account.nama) },
                        modifier = Modifier.heightIn(min = 40.dp).testTag("account_${account.id}"),
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = line.nominal,
                    onValueChange = { raw ->
                        val parsed = Money.parse(raw)
                        onUpdatePayment(index) { it.copy(nominal = parsed?.stripTrailingZeros()?.toPlainString() ?: "") }
                    },
                    label = { Text("Nominal") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f).testTag("checkout_nominal"),
                )
                if (state.draft.payments.size > 1) {
                    TextButton(onClick = { onRemovePayment(index) }) { Text("Hapus") }
                }
            }
        }
    }
    OutlinedButton(onClick = onAddPayment, modifier = Modifier.heightIn(min = 44.dp)) {
        Text("Tambah pembayaran")
    }

    val paid = state.paid
    val selisih = state.total - paid
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Total Dibayar", fontWeight = FontWeight.SemiBold)
        Text(Money.formatRupiah(paid), fontWeight = FontWeight.SemiBold)
    }
    when {
        selisih.signum() < 0 -> Text(
            "Kembalian: ${Money.formatRupiah(selisih.abs())}",
            color = PosTheme.success,
            fontWeight = FontWeight.SemiBold,
        )
        selisih.signum() > 0 && paid.signum() > 0 -> Text(
            "Sisa Kurang (Piutang): ${Money.formatRupiah(selisih)}",
            color = PosTheme.danger,
            fontWeight = FontWeight.SemiBold,
        )
        else -> Text("Status Pembayaran: Pas / Lunas", color = PosTheme.success, fontWeight = FontWeight.SemiBold)
    }

    OutlinedButton(
        onClick = {
            val account = accounts.firstOrNull {
                it.nama.lowercase().contains("kasir") || it.nama.lowercase().contains("cash")
            } ?: accounts.firstOrNull()
            val others = state.draft.payments.drop(1)
                .fold(BigDecimal.ZERO) { sum, line -> sum + (Money.parse(line.nominal) ?: BigDecimal.ZERO) }
            val nominal = (state.total - others).max(BigDecimal.ZERO)
            onDraft { draft ->
                val first = draft.payments.firstOrNull() ?: PaymentLine()
                draft.copy(
                    payment = "Tunai",
                    nominalBayar = state.total.stripTrailingZeros().toPlainString(),
                    payments = listOf(
                        first.copy(
                            accountId = first.accountId.ifBlank { account?.id.orEmpty() },
                            nominal = nominal.stripTrailingZeros().toPlainString(),
                        ),
                    ) + draft.payments.drop(1),
                )
            }
        },
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("checkout_exact"),
    ) { Text("Uang Pas (Auto Lunas)") }

    OutlinedTextField(
        value = state.draft.nominalBayar,
        onValueChange = { raw ->
            val parsed = Money.parse(raw)
            onDraft { it.copy(nominalBayar = parsed?.stripTrailingZeros()?.toPlainString() ?: "") }
        },
        label = { Text("Uang diterima (untuk kembalian)") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )

    if (state.draft.payment == "Tempo") {
        OutlinedTextField(
            value = state.draft.tempoDate,
            onValueChange = { value -> onDraft { it.copy(tempoDate = value) } },
            label = { Text("Tanggal Jatuh Tempo (yyyy-MM-dd)") },
            placeholder = { Text(LocalDate.now().plusDays(7).toString()) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("checkout_tempo"),
        )
    }

    if (state.isOnline) {
        OutlinedTextField(
            value = state.draft.marketplace,
            onValueChange = { value -> onDraft { it.copy(marketplace = value) } },
            label = { Text("Platform (Shopee/Tokped) *") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("checkout_marketplace"),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = state.draft.adminFee,
                onValueChange = { raw ->
                    val parsed = Money.parse(raw)
                    onDraft { it.copy(adminFee = parsed?.stripTrailingZeros()?.toPlainString() ?: "") }
                },
                label = { Text("Biaya admin (-)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
            OutlinedTextField(
                value = state.draft.cashback,
                onValueChange = { raw ->
                    val parsed = Money.parse(raw)
                    onDraft { it.copy(cashback = parsed?.stripTrailingZeros()?.toPlainString() ?: "") }
                },
                label = { Text("Cashback (+)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun NotesTab(
    state: PosUiState,
    onDraft: ((CheckoutDraft) -> CheckoutDraft) -> Unit,
    onCaptureProof: () -> Unit,
) {
    val service = PosPricing.isService(state.draft.menu)
    OutlinedTextField(
        value = state.draft.noteMenu,
        onValueChange = { value -> onDraft { it.copy(noteMenu = value) } },
        label = { Text(if (service) "Jenis motor / catatan nota *" else "Catatan nota") },
        placeholder = { Text("Contoh: Garansi 1 Minggu...") },
        modifier = Modifier.fillMaxWidth().testTag("checkout_note_menu"),
    )
    OutlinedTextField(
        value = state.draft.note,
        onValueChange = { value -> onDraft { it.copy(note = value) } },
        label = { Text("Catatan kas (internal)") },
        placeholder = { Text("Informasi kasir (tidak di-print)...") },
        modifier = Modifier.fillMaxWidth().testTag("checkout_note"),
    )

    if (PosPricing.isPembelian(state.draft.menu)) {
        Text(
            "Lampiran Media / Bukti",
            style = MaterialTheme.typography.labelLarge,
        )
        OutlinedButton(
            onClick = onCaptureProof,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("checkout_media"),
        ) {
            Text(
                if (state.draft.mediaCount == 0) {
                    "Tambah file (status belum sampai media terunggah)"
                } else {
                    "${state.draft.mediaCount} file siap, unggah menunggu jaringan"
                },
            )
        }
    }
}

@Composable
private fun PriceDialog(
    product: Produk,
    current: BigDecimal?,
    onConfirm: (BigDecimal) -> Unit,
    onReset: () -> Unit,
    onDismiss: () -> Unit,
) {
    var text by remember(product.id) { mutableStateOf(current?.stripTrailingZeros()?.toPlainString().orEmpty()) }
    val beli = product.beli
    val typed = Money.parse(text)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Harga ${PosFeed.productLabel(product)}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Eceran ${Money.formatRupiah(product.sell6)} · Pelanggan ${Money.formatRupiah(product.sell5)}")
                if (product.min1.signum() > 0) {
                    Text(
                        "Grosir besar ≥ ${product.min1.stripTrailingZeros().toPlainString()}: " +
                            Money.formatRupiah(product.sell1),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (product.min2.signum() > 0) {
                    Text(
                        "Grosir sedang ≥ ${product.min2.stripTrailingZeros().toPlainString()}: " +
                            Money.formatRupiah(product.sell2),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (product.min3.signum() > 0) {
                    Text(
                        "Grosir kecil ≥ ${product.min3.stripTrailingZeros().toPlainString()}: " +
                            Money.formatRupiah(product.sell3),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                OutlinedTextField(
                    value = text,
                    onValueChange = { raw ->
                        val parsed = Money.parse(raw)
                        text = parsed?.stripTrailingZeros()?.toPlainString() ?: ""
                    },
                    label = { Text("Harga satuan") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                if (typed != null && typed < beli) {
                    Text(
                        "Harga di bawah harga beli (${Money.formatRupiah(beli)})",
                        color = PosTheme.warning,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Text(
                    "Harga manual tetap saat jumlah berubah.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { typed?.let(onConfirm) },
                enabled = (typed ?: BigDecimal.ZERO).signum() > 0,
            ) { Text("Pakai harga") }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onReset) { Text("Harga otomatis") }
                TextButton(onClick = onDismiss) { Text("Batal") }
            }
        },
    )
}
