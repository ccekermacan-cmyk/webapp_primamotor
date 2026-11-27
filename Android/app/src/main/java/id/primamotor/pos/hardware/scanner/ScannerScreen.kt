package id.primamotor.pos.hardware.scanner

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

/** Kamera hanya hidup saat layar ini terbuka; ditutup lagi di onDispose. */
@Composable
fun ScannerScreen(onResult: (String) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    var granted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    val executor = remember { Executors.newSingleThreadExecutor() }

    LaunchedEffect(Unit) {
        if (!granted) launcher.launch(Manifest.permission.CAMERA)
    }

    DisposableEffect(Unit) {
        onDispose { executor.shutdown() }
    }

    Box(Modifier.fillMaxSize()) {
        if (granted) {
            AndroidView(
                modifier = Modifier.fillMaxSize().testTag("scanner_preview"),
                factory = { ctx ->
                    val preview = PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
                    val future = ProcessCameraProvider.getInstance(ctx)
                    future.addListener({
                        val provider = future.get()
                        val analysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()
                            .also { it.setAnalyzer(executor, BarcodeAnalyzer { code -> onResult(code) }) }
                        val useCase = androidx.camera.core.Preview.Builder().build()
                        useCase.setSurfaceProvider(preview.surfaceProvider)
                        provider.unbindAll()
                        provider.bindToLifecycle(lifecycle, CameraSelector.DEFAULT_BACK_CAMERA, useCase, analysis)
                    }, ContextCompat.getMainExecutor(ctx))
                    preview
                },
            )
        } else {
            Text("Izin kamera diperlukan untuk memindai barcode.", modifier = Modifier.align(Alignment.Center).padding(24.dp))
        }

        Button(
            onClick = onClose,
            modifier = Modifier.align(Alignment.BottomCenter).padding(24.dp).testTag("scanner_close"),
        ) { Text("Tutup") }
    }
}