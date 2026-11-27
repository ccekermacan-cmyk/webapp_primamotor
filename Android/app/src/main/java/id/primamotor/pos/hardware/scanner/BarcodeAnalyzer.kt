package id.primamotor.pos.hardware.scanner

import android.annotation.SuppressLint
import android.os.SystemClock
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.NotFoundException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer

/**
 * Decode barcode dari frame kamera memakai ZXing core (tanpa ML Kit, APK tetap kecil).
 * Dibatasi ~5 frame/detik agar CPU dingin; frame di luar batas tetap ditutup.
 */
class BarcodeAnalyzer(private val onResult: (String) -> Unit) : ImageAnalysis.Analyzer {

    private val reader = MultiFormatReader().apply {
        setHints(
            mapOf(
                DecodeHintType.POSSIBLE_FORMATS to listOf(
                    BarcodeFormat.EAN_13,
                    BarcodeFormat.EAN_8,
                    BarcodeFormat.CODE_128,
                    BarcodeFormat.CODE_39,
                    BarcodeFormat.UPC_A,
                    BarcodeFormat.UPC_E,
                    BarcodeFormat.QR_CODE,
                    BarcodeFormat.ITF,
                ),
                DecodeHintType.TRY_HARDER to true,
            ),
        )
    }

    private var lastAnalyzedAt = 0L

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(image: ImageProxy) {
        try {
            val now = SystemClock.elapsedRealtime()
            if (now - lastAnalyzedAt < 200) return
            lastAnalyzedAt = now

            val plane = image.planes.firstOrNull() ?: return
            val buffer = plane.buffer
            val bytes = ByteArray(buffer.remaining()).also { buffer.get(it) }
            val source = PlanarYUVLuminanceSource(
                bytes,
                image.width,
                image.height,
                0,
                0,
                image.width,
                image.height,
                false,
            )
            val text = try {
                reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text
            } catch (_: NotFoundException) {
                null
            } finally {
                reader.reset()
            }
            if (!text.isNullOrBlank()) onResult(text)
        } catch (_: Throwable) {
            // Frame rusak tidak boleh menghentikan analisis berikutnya.
        } finally {
            image.close()
        }
    }
}