<?php
// Local CLI reads the same source as Docker; explicit test env overrides remain supported.
$path = dirname(base_path()).'/datasource';
$source = is_file($path) ? parse_ini_file($path, false, INI_SCANNER_RAW) : [];
return [
    'pocketbase_url' => isset($source['PB_HOST_PORT']) ? 'http://127.0.0.1:'.$source['PB_HOST_PORT'] : env('PM_PB_INTERNAL_URL'),
    'database' => isset($source['PB_DATA_DIR']) ? dirname(base_path()).'/'.$source['PB_DATA_DIR'].'/data.db' : env('DB_DATABASE'),
];
