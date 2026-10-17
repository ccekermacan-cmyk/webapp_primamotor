/// <reference path="../pb_data/types.d.ts" />

/**
 * Forwarding routes to Laravel API
 * Because Cloudflare only tunnels port 8090 (PocketBase),
 * we need PocketBase to proxy webhook & report requests to Laravel (port 8000).
 */

routerAdd("POST", "/api/webhook/{collection}/{event}/{id}", (c) => {
    const collection = c.request.pathValue("collection");
    const event = c.request.pathValue("event");
    const id = c.request.pathValue("id");
    
    // Forward to Laravel container
    try {
        const body = c.requestInfo().body;
        const res = $http.send({
            url: `http://pm-nginx/api/webhook/${collection}/${event}/${id}`,
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json", "Authorization": c.request.header.get("Authorization") }
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
            url: `http://pm-nginx/api/reports/recalculate`,
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json", "Authorization": c.request.header.get("Authorization") }
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
            url: "http://pm-nginx/api/webhooks/batch",
            method: "POST", body: JSON.stringify(c.requestInfo().body),
            headers: { "Content-Type": "application/json", "Authorization": c.request.header.get("Authorization") }
        });
        return c.json(res.statusCode, res.json);
    } catch (err) { return c.json(502, { error: "Backend tidak tersedia" }); }
});

routerAdd("DELETE", "/api/transactions/{collection}/{id}", (c) => {
    try {
        const res = $http.send({
            url: `http://pm-nginx/api/transactions/${c.request.pathValue("collection")}/${c.request.pathValue("id")}`,
            method: "DELETE", headers: { "Authorization": c.request.header.get("Authorization") }
        });
        return c.json(res.statusCode, res.json);
    } catch (err) { return c.json(502, { error: "Backend tidak tersedia" }); }
});
