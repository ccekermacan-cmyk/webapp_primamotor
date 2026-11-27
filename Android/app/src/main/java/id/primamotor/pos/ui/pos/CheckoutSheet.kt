package id.primamotor.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosValidation
import java.math.BigDecimal
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutSheet(
    state: PosUiState,
    accounts: List<PersonRow>,
    onQty: (String, BigDecimal) -> Unit,
    onRemove: (String) -> Unit,
    onDraft: ((CheckoutDraft) -> CheckoutDraft) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val direction = PosValidation.directionOf(state.draft.menu)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Keranjang", style = MaterialTheme.typography.titleLarge)

            state.cart.forEach { entry ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(entry.produk.nama)
                        Text(
                            "${Money.formatRupiah(entry.produk.sell1)} x ${entry.qty.stripTrailingZeros().toPlainString()}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    TextButton(onClick = { onQty(entry.produk.id, entry.qty - BigDecimal.ONE) }) { Text("-") }
                    Text(entry.qty.stripTrailingZeros().toPlainString())
                    TextButton(onClick = { onQty(entry.produk.id, entry.qty + BigDecimal.ONE) }) { Text("+") }
                    TextButton(onClick = { onRemove(entry.produk.id) }) { Text("Hapus") }
                }
            }

            HorizontalDivider()

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Total", style = MaterialTheme.typography.titleMedium)
                Text(
                    Money.formatRupiah(state.total),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.testTag("checkout_total"),
                )
            }

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

            OutlinedTextField(
                value = state.draft.nominalBayar,
                onValueChange = { raw ->
                    val parsed = Money.parse(raw)
                    onDraft { it.copy(nominalBayar = parsed?.stripTrailingZeros()?.toPlainString() ?: "") }
                },
                label = { Text("Nominal bayar") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("checkout_nominal"),
            )

            if (state.draft.payment == "Tunai" && direction == "out" && accounts.isNotEmpty()) {
                Text("Akun penerima", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    accounts.take(4).forEach { account ->
                        FilterChip(
                            selected = state.draft.accountId == account.id,
                            onClick = { onDraft { it.copy(accountId = account.id) } },
                            label = { Text(account.nama) },
                            modifier = Modifier.testTag("account_${account.id}"),
                        )
                    }
                }
            }

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

            OutlinedTextField(
                value = state.draft.note,
                onValueChange = { value -> onDraft { it.copy(note = value) } },
                label = { Text("Catatan") },
                modifier = Modifier.fillMaxWidth().testTag("checkout_note"),
            )

            if (state.error != null) {
                Text(state.error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("checkout_error"))
            }

            Button(
                onClick = onSubmit,
                enabled = !state.saving && state.cart.isNotEmpty(),
                modifier = Modifier.fillMaxWidth().testTag("checkout_submit"),
            ) {
                Text(if (state.saving) "Menyimpan..." else "Simpan transaksi")
            }
        }
    }
}