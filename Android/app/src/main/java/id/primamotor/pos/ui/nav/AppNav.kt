package id.primamotor.pos.ui.nav

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch

/** Rute utama, sama dengan menu sidebar web. */
enum class TopRoute(
    val route: String,
    val label: String,
    val initial: String,
    val tint: Color,
    val icon: ImageVector,
) {
    POS("pos", "Kasir", "KS", Color(0xFF2563EB), Icons.Filled.ShoppingCart),
    HISTORY("history", "Riwayat", "RW", Color(0xFF7C3AED), Icons.Filled.DateRange),
    PRODUCTS("products", "Produk", "PR", Color(0xFFEA580C), Icons.Filled.Star),
    CASHFLOW("cashflow", "Kas", "KA", Color(0xFF059669), Icons.Filled.List),
    ACCOUNT("account", "Akun", "AK", Color(0xFFDB2777), Icons.Filled.Person),
}

@Composable
fun AppNav(
    onLogout: () -> Unit = {},
    userName: String = "",
    userLevel: String = "",
    posScreen: @Composable () -> Unit = { PlaceholderScreen("Kasir") },
    historyScreen: @Composable () -> Unit = { PlaceholderScreen("Riwayat") },
    productsScreen: @Composable () -> Unit = { PlaceholderScreen("Produk") },
    cashflowScreen: @Composable () -> Unit = { PlaceholderScreen("Kas") },
    accountScreen: @Composable () -> Unit = { AccountPlaceholder(onLogout) },
    topBar: @Composable () -> Unit = {},
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val selected = backStackEntry?.destination
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val navigate: (String) -> Unit = { route ->
        scope.launch { drawerState.close() }
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawer(
                userName = userName,
                userLevel = userLevel,
                selectedRoute = selected?.hierarchy?.firstOrNull { dest ->
                    TopRoute.entries.any { it.route == dest.route }
                }?.route,
                onNavigate = navigate,
                onLogout = onLogout,
            )
        },
    ) {
        Scaffold(
            topBar = {
                Column {
                    Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 2.dp) {
                        Row(
                            Modifier.fillMaxWidth().height(76.dp).padding(horizontal = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier
                                    .size(48.dp)
                                    .clickable { scope.launch { drawerState.open() } }
                                    .testTag("nav_menu"),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = MaterialTheme.colorScheme.onSurface)
                            }
                            Text(
                                "PRIMA ",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                "MOTOR",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.weight(1f))
                            Text(
                                selected?.route?.let { route -> TopRoute.entries.firstOrNull { it.route == route }?.label }
                                    ?: "Kasir",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(end = 12.dp),
                            )
                        }
                    }
                    topBar()
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
                        when (item) {
                            TopRoute.POS -> posScreen()
                            TopRoute.HISTORY -> historyScreen()
                            TopRoute.PRODUCTS -> productsScreen()
                            TopRoute.CASHFLOW -> cashflowScreen()
                            TopRoute.ACCOUNT -> accountScreen()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AppDrawer(
    userName: String,
    userLevel: String,
    selectedRoute: String?,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    ModalDrawerSheet(
        modifier = Modifier.width(320.dp).fillMaxHeight(),
        drawerContainerColor = MaterialTheme.colorScheme.surface,
        drawerShape = RoundedCornerShape(topEnd = 0.dp, bottomEnd = 0.dp),
    ) {
        Column(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier.size(64.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.ShoppingCart, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                }
                Spacer(Modifier.height(10.dp))
                Row {
                    Text("PRIMA ", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                    Text("MOTOR", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .clickable { onNavigate(TopRoute.ACCOUNT.route) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(52.dp).background(Color(0xFF0F172A), RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        userName.trim().take(2).uppercase().ifBlank { "KS" },
                        color = Color.White,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("KASIR AKTIF", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        userName.ifBlank { "Kasir" },
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Text(
                    "Lv-${userLevel.ifBlank { "0" }}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Column(
                Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TopRoute.entries.forEach { item ->
                    DrawerItem(item = item, selected = item.route == selectedRoute) { onNavigate(item.route) }
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(56.dp).testTag("logout"),
            ) { Text("Keluar") }
        }
    }
}

@Composable
private fun DrawerItem(item: TopRoute, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(
                if (selected) item.tint.copy(alpha = 0.12f) else Color.Transparent,
                RoundedCornerShape(18.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp)
            .testTag("tab_${item.route}"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(44.dp).background(Color.White, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(item.icon, contentDescription = null, tint = item.tint, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(14.dp))
        Text(
            item.label.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (selected) FontWeight.Black else FontWeight.Bold,
            color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
        )
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
        SplashTestTags(onLogout)
    }
}

@Composable
private fun SplashTestTags(onLogout: () -> Unit) {
    OutlinedButton(onClick = onLogout, modifier = Modifier.testTag("logout")) { Text("Keluar") }
}

@Composable
private fun PlaceholderScreen(label: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = label)
    }
}
