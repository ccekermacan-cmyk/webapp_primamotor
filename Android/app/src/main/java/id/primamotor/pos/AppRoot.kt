package id.primamotor.pos

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.data.remote.UserSession
import id.primamotor.pos.ui.login.LoginScreen
import id.primamotor.pos.ui.login.LoginViewModel
import id.primamotor.pos.ui.nav.AppNav
import id.primamotor.pos.ui.pos.PosRoute

/**
 * Gerbang sesi: sesi tersimpan (cache terenkripsi) langsung membuka POS tanpa jaringan.
 * Login pertama tetap butuh server.
 */
@Composable
fun AppRoot(container: AppContainer) {
    var session by remember { mutableStateOf(container.tokenStore.cachedUser()) }

    if (session != null) {
        AppNav(
            onLogout = {
                session = null
                container.tokenStore.clear()
            },
            posScreen = { PosRoute(container) },
        )
    } else {
        LoginRoute(container) { loggedIn -> session = loggedIn }
    }
}

@Composable
private fun LoginRoute(container: AppContainer, onLoggedIn: (UserSession) -> Unit) {
    val viewModel: LoginViewModel = viewModel { LoginViewModel(container.sessions) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    val current = state.session
    if (current != null) {
        onLoggedIn(current)
    }

    LoginScreen(state = state, onLogin = viewModel::login)
}