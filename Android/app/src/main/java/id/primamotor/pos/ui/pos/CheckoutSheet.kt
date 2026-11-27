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
) {
    val service = PosPricing.isService(state.draft.menu)
    var priceTarget by remember { mutableStateOf<Produk?>(null) }
    val captureProof = rememberPhotoCapture { path ->
        onDraft { it.copy(mediaPath = path, mediaCount = it.mediaCount + 1) }
    }

    Text(
        if (state.edit != null) "Edit Nota ${state.edit?.menuId}" else "Keranjang",
        style = MaterialTheme.typography.titleLarge,
    )

    if (state.cart.isEmpty()) {
        Text(
            if (service) {
                "Menu service boleh tanpa sparepart. Isi ongkos mekanik di bawah."
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
                Text(line.produk.nama)
                Text(
                    "${Money.formatRupiah(line.price)} x ${line.qty.stripTrailingZeros().toPlainString()}" +
                        (if (line.tiered) " • ${line.label}" else ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (line.tiered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = { priceTarget = line.produk }, modifier = Modifier.heightIn(min = 36.dp)) {
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
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(customers, key = { it.id }) { person ->
            FilterChip(
                selected = state.draft.personIdLama == person.idLama.ifBlank { person.id },
                onClick = { onCustomer(person) },
                label = { Text(person.nama) },
            )
        }
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
            Text("${Money.formatRupiah(Money.parse(state.draft.adminFee))} / ${Money.formatRupiah(Money.parse(state.draft.cashback))}")
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

    if (service) {
        Text("Mekanik & Ongkos", style = MaterialTheme.typography.labelLarge)
        state.draft.mechanics.forEachIndexed { index, line ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(mechanics, key = { it.id }) { mechanic ->
                        val value = mechanic.username
                        FilterChip(
                            selected = line.idLama == value,
                            onClick = { onUpdateMechanic(index) { it.copy(idLama = value) } },
                            label = { Text(mechanic.name.ifBlank { value }) },
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

    Text("Pembayaran", style = MaterialTheme.typography.labelLarge)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("Tunai", "Tempo").forEach { payment ->
            FilterChip(
                selected = state.draft.payment == payment,
                onClick = { onDraft { it.copy(payment = payment) } },
                label = { Text(payment) },
                modifier = Modifier.testTag("payment_$payment"),
            )
        }
    }

    state.draft.payments.forEachIndexed { index, line ->
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(accounts, key = { it.id }) { account ->
                    FilterChip(
                        selected = line.accountId == account.id,
                        onClick = { onUpdatePayment(index) { it.copy(accountId = account.id) } },
                        label = { Text(account.nama) },
                        modifier = Modifier.testTag("account_${account.id}"),
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
                    label = { Text("Nominal akun") },
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
        Text("Tambah akun pembayaran")
    }

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
            label = { Text("Jatuh tempo (yyyy-MM-dd)") },
            placeholder = { Text(LocalDate.now().plusDays(7).toString()) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("checkout_tempo"),
        )
    }

    if (state.isOnline) {
        OutlinedTextField(
            value = state.draft.marketplace,
            onValueChange = { value -> onDraft { it.copy(marketplace = value) } },
            label = { Text("Marketplace *") },
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
                label = { Text("Admin fee") },
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
                label = { Text("Cashback") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
        }
    }

    if (PosPricing.isPembelian(state.draft.menu)) {
        OutlinedButton(
            onClick = captureProof,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("checkout_media"),
        ) {
            Text(
                if (state.draft.mediaCount == 0) {
                    "Ambil bukti pembelian (status belum sampai media terunggah)"
                } else {
                    "Bukti siap: ${state.draft.mediaCount} foto, unggah menunggu jaringan"
                },
            )
        }
    }

    OutlinedTextField(
        value = state.draft.noteMenu,
        onValueChange = { value -> onDraft { it.copy(noteMenu = value) } },
        label = { Text(if (service) "Jenis motor / catatan nota *" else "Catatan nota") },
        modifier = Modifier.fillMaxWidth().testTag("checkout_note_menu"),
    )
    OutlinedTextField(
        value = state.draft.note,
        onValueChange = { value -> onDraft { it.copy(note = value) } },
        label = { Text("Catatan pembayaran") },
        modifier = Modifier.fillMaxWidth().testTag("checkout_note"),
    )

    if (state.error != null) {
        Text(state.error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("checkout_error"))
    }

    if (state.edit != null) {
        Text(
            "Menyimpan akan menimpa nota lama; tanggal nota tidak berubah.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(onClick = onCancelEdit) { Text("Batalkan mode edit") }
    }

    Button(
        onClick = onSubmit,
        enabled = !state.saving && (state.cart.isNotEmpty() || service),
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("checkout_submit"),
    ) {
        Text(
            when {
                state.saving -> "Menyimpan..."
                state.edit != null -> "Perbarui transaksi"
                else -> "Simpan transaksi"
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
private fun PriceDialog(
    product: Produk,
    current: BigDecimal?,
    onConfirm: (BigDecimal) -> Unit,
    onReset: () -> Unit,
    onDismiss: () -> Unit,
) {
    var text by remember(product.id) { mutableStateOf(current?.stripTrailingZeros()?.toPlainString().orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Harga ${product.nama}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Harga eceran ${Money.formatRupiah(product.sell6)}. Isi harga khusus bila perlu.")
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
            }
        },
        confirmButton = {
            TextButton(
                onClick = { Money.parse(text)?.let(onConfirm) },
                enabled = (Money.parse(text) ?: BigDecimal.ZERO).signum() > 0,
            ) { Text("Pakai harga") }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onReset) { Text("Harga normal") }
                TextButton(onClick = onDismiss) { Text("Batal") }
            }
        },
    )
}
