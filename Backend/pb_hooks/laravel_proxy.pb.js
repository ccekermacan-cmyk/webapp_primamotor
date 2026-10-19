/// <reference path="../pb_data/types.d.ts" />

/**
 * Forwarding routes to Laravel API
 * Docker injects PM_API_INTERNAL_URL from the root datasource file.
 */

routerAdd("POST", "/api/webhook/{collection}/{event}/{id}", (c) => {
    const collection = c.request.pathValue("collection");
    const event = c.request.pathValue("event");
    const id = c.request.pathValue("id");
    
    // Forward to Laravel container
    try {
        const body = c.requestInfo().body;
        const res = $http.send({
            url: `${$os.getenv("PM_API_INTERNAL_URL")}/webhook/${collection}/${event}/${id}`,
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": c.request.header.get("Authorization") }
        });
        
        return c.json(res.statusCode, res.json);
    } catch (err) {
        return c.json(500, { error: err.message || "Proxy error" });
    }
});

routerAdd("POST", "/api/reports/recalculate", (c) => {
    try {
        const body = c.requestInfo().body;
        const res = $http.send({
            url: `${$os.getenv("PM_API_INTERNAL_URL")}/reports/recalculate`,
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": c.request.header.get("Authorization") }
        });
        
        return c.json(res.statusCode, res.json);
    } catch (err) {
        return c.json(500, { error: err.message || "Proxy error" });
    }
});

routerAdd("OPTIONS", "/api/reports/recalculate", (c) => {
    // Handle CORS preflight explicitly for proxy routes if needed
    return c.noContent(204);
});

routerAdd("POST", "/api/webhooks/batch", (c) => {
    try {
        const res = $http.send({
            url: `${$os.getenv("PM_API_INTERNAL_URL")}/webhooks/batch`,
            method: "POST", body: JSON.stringify(c.requestInfo().body),
            headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": c.request.header.get("Authorization") }
        });
        return c.json(res.statusCode, res.json);
    } catch (err) { return c.json(502, { error: "Backend tidak tersedia" }); }
});

routerAdd("DELETE", "/api/transactions/{collection}/{id}", (c) => {
    try {
        const res = $http.send({
            url: `${$os.getenv("PM_API_INTERNAL_URL")}/transactions/${c.request.pathValue("collection")}/${c.request.pathValue("id")}`,
            method: "DELETE", headers: { "Accept": "application/json", "Authorization": c.request.header.get("Authorization") }
        });
        return c.json(res.statusCode, res.json);
    } catch (err) { return c.json(502, { error: "Backend tidak tersedia" }); }
});
