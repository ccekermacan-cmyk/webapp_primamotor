/// <reference path="../pb_data/types.d.ts" />

/**
 * Forwarding routes to Laravel API
 * Because Cloudflare only tunnels port 8090 (PocketBase),
 * we need PocketBase to proxy webhook & report requests to Laravel (port 8000).
 */

routerAdd("POST", "/api/webhook/:collection/:event/:id", (c) => {
    const collection = c.pathParam("collection");
    const event = c.pathParam("event");
    const id = c.pathParam("id");
    
    // Forward to Laravel container
    try {
        const body = c.requestInfo().body;
        const res = $http.send({
            url: `http://laravel-prima-motor:8000/api/webhook/${collection}/${event}/${id}`,
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
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
            url: `http://laravel-prima-motor:8000/api/reports/recalculate`,
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
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
