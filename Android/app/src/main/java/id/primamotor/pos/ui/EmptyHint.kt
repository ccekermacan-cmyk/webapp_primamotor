package id.primamotor.pos.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Cache lokal kosong bukan kerusakan: biasanya belum pernah sinkron.
 * Arahkan ke satu tindakan, jangan hanya menampilkan layar kosong.
 */
@Composable
fun EmptyHint(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(24.dp)) {
        Text("Belum ada data.", style = MaterialTheme.typography.bodyLarge)
        Text(
            "Sambungkan internet, lalu buka Akun → Pengaturan → Sinkron sekarang.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
