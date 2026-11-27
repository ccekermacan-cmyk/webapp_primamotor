package id.primamotor.pos

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.data.remote.UserSession
import id.primamotor.pos.ui.login.LoginScreen
import id.primamotor.pos.ui.login.LoginViewModel
import id.primamotor.pos.ui.nav.AppNav
import id.primamotor.pos.ui.cashflow.CashflowRoute
import id.primamotor.pos.ui.account.AccountRoute
import id.primamotor.pos.ui.pos.PosRoute
import id.primamotor.pos.ui.person.PersonRoute
import id.primamotor.pos.ui.report.ReportRoute
import id.primamotor.pos.ui.settings.MasterSettingsRoute
import id.primamotor.pos.ui.products.ProductsRoute
import id.primamotor.pos.ui.sync.SyncStatusBar
import id.primamotor.pos.ui.sync.SyncViewModel

/**
 * Gerbang sesi: sesi tersimpan (cache terenkripsi) langsung membuka POS tanpa jaringan.
 * Login pertama tetap butuh server.
 */
@Composable
fun AppRoot(container: AppContainer) {
    var session by remember { mutableStateOf(container.tokenStore.cachedUser()) }
    val scope = rememberCoroutineScope()
    val logout: () -> Unit = {
        session = null
        container.tokenStore.clear()
        scope.launch {
            // Gaji bersifat pribadi: cache dibuang saat logout, outbox tidak disentuh.
            container.database.localRecordDao().deleteCleanCollection("gaji")
        }
    }

    if (session != null) {
        val syncViewModel: SyncViewModel = viewModel { SyncViewModel(container) }
        LaunchedEffect(session?.id) {
            if (session != null) syncViewModel.syncNow()
        }
        AppNav(
            onLogout = logout,
            userName = session?.name.orEmpty().ifBlank { session?.username.orEmpty() },
            userLevel = session?.level?.toString().orEmpty(),
            levelNumber = session?.level ?: 0,
            posScreen = { PosRoute(container) },
            productsScreen = { ProductsRoute(container) },
            personScreen = { PersonRoute(container) },
            cashflowScreen = { CashflowRoute(container) },
            reportScreen = { ReportRoute(container) },
            accountScreen = { AccountRoute(container, onLogout = logout) },
            settingsScreen = { MasterSettingsRoute(container) },
            topBar = { SyncStatusBar(syncViewModel) },
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