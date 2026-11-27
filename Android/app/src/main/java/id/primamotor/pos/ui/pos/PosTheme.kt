package id.primamotor.pos.ui.pos

import androidx.compose.ui.graphics.Color

/** Warna tema per menu, cermin `getThemeConfig` di `pages/pos.tsx`. */
data class PosAccent(val main: Color, val light: Color)

object PosTheme {

    private val overview = PosAccent(Color(0xFF4F46E5), Color(0xFFEEF2FF))

    fun accent(menu: String): PosAccent {
        val lower = menu.lowercase()
        return when {
            lower.contains("overview") -> overview
            lower.contains("penjualan") -> PosAccent(Color(0xFF10B981), Color(0xFFECFDF5))
            lower.contains("service") || lower.contains("servis") -> PosAccent(Color(0xFF3B82F6), Color(0xFFEFF6FF))
            lower.contains("pembelian") -> PosAccent(Color(0xFFF59E0B), Color(0xFFFFFBEB))
            lower.contains("gaji") -> PosAccent(Color(0xFF14B8A6), Color(0xFFF0FDFA))
            lower.contains("grosir") -> PosAccent(Color(0xFF8B5CF6), Color(0xFFF5F3FF))
            lower.contains("retur") -> PosAccent(Color(0xFFF43F5E), Color(0xFFFFF1F2))
            else -> overview
        }
    }

    /** Badge jenis pada kartu riwayat, cermin `getJenisColor`. */
    fun jenisColors(jenis: String): Pair<Color, Color> {
        val lower = jenis.lowercase()
        return when {
            lower.contains("penjualan") -> Color(0xFF10B981) to Color(0xFFECFDF5)
            lower.contains("service") || lower.contains("servis") -> Color(0xFF3B82F6) to Color(0xFFEFF6FF)
            lower.contains("pembelian") -> Color(0xFFF97316) to Color(0xFFFFF7ED)
            else -> Color(0xFF64748B) to Color(0xFFF1F5F9)
        }
    }

    val muted = Color(0xFF64748B)
    val hairline = Color(0xFFE2E8F0)
    val card = Color(0xFFFFFFFF)
    val canvas = Color(0xFFF8FAFC)
    val danger = Color(0xFFE11D48)
    val success = Color(0xFF059669)
    val warning = Color(0xFFB45309)
}
