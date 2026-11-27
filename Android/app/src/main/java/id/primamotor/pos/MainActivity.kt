package id.primamotor.pos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import id.primamotor.pos.ui.nav.AppNav
import id.primamotor.pos.ui.theme.PrimaMotorTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PrimaMotorTheme {
                AppNav()
            }
        }
    }
}