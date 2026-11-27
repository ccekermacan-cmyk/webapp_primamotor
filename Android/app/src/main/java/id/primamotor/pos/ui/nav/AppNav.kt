package id.primamotor.pos.ui.nav

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController

/** Rute utama. Fase lanjut menambah login, settings, dan report di luar bottom bar. */
enum class TopRoute(val route: String, val label: String) {
    POS("pos", "POS"),
    HISTORY("history", "Riwayat"),
    PRODUCTS("products", "Produk"),
    CASHFLOW("cashflow", "Kas"),
    ACCOUNT("account", "Akun"),
}

@Composable
fun AppNav(onLogout: () -> Unit = {}) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val selected = backStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                TopRoute.entries.forEach { item ->
                    NavigationBarItem(
                        selected = selected?.hierarchy?.any { it.route == item.route } == true,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Text(item.label) },
                        label = null,
                        modifier = Modifier.testTag("tab_${item.route}"),
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = TopRoute.POS.route,
            modifier = Modifier.padding(padding),
        ) {
            TopRoute.entries.forEach { item ->
                composable(item.route) {
                    if (item == TopRoute.ACCOUNT) {
                        AccountPlaceholder(onLogout)
                    } else {
                        PlaceholderScreen(item.label)
                    }
                }
            }
        }
    }
}

@Composable
private fun AccountPlaceholder(onLogout: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Akun")
        OutlinedButton(onClick = onLogout, modifier = Modifier.testTag("logout")) { Text("Keluar") }
    }
}

@Composable
private fun PlaceholderScreen(label: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = label)
    }
}